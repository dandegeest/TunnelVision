#!/usr/bin/env python3
"""Decode a clip and record frame-to-frame motion + destination similarity."""

from __future__ import annotations

import argparse
import csv
import json
import math
import subprocess
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageFont

PYTHON_NOTE = "experiment-local diagnostic. Not production."


def probe(path: Path) -> dict:
    info = json.loads(
        subprocess.check_output(
            [
                "ffprobe",
                "-v",
                "error",
                "-print_format",
                "json",
                "-show_streams",
                "-select_streams",
                "v:0",
                str(path),
            ],
            text=True,
        )
    )
    stream = next(s for s in info["streams"] if s["codec_type"] == "video")
    rate = stream.get("avg_frame_rate") or stream.get("r_frame_rate") or "24/1"
    num, den = (rate.split("/") + ["1"])[:2]
    fps = float(num) / float(den) if float(den) else 24.0
    return {
        "width": int(stream["width"]),
        "height": int(stream["height"]),
        "fps": fps,
        "duration": float(stream.get("duration") or 0),
    }


def decode(path: Path) -> tuple[np.ndarray, dict]:
    meta = probe(path)
    w, h = meta["width"], meta["height"]
    raw = subprocess.check_output(
        ["ffmpeg", "-hide_banner", "-loglevel", "error", "-i", str(path), "-f", "rawvideo", "-pix_fmt", "rgb24", "pipe:1"]
    )
    n = len(raw) // (w * h * 3)
    frames = np.frombuffer(raw, dtype=np.uint8).reshape((n, h, w, 3)).copy()
    meta["decoded_frames"] = n
    return frames, meta


def ssim_gray(a: np.ndarray, b: np.ndarray, win: int = 16) -> float:
    a_f = a.astype(np.float64)
    b_f = b.astype(np.float64)
    h, w = a_f.shape
    c1 = (0.01 * 255) ** 2
    c2 = (0.03 * 255) ** 2
    acc = []
    for y in range(0, h - win + 1, win):
        for x in range(0, w - win + 1, win):
            pa = a_f[y : y + win, x : x + win]
            pb = b_f[y : y + win, x : x + win]
            mu_a, mu_b = pa.mean(), pb.mean()
            var_a, var_b = pa.var(), pb.var()
            cov = ((pa - mu_a) * (pb - mu_b)).mean()
            den = (mu_a**2 + mu_b**2 + c1) * (var_a + var_b + c2)
            acc.append(((2 * mu_a * mu_b + c1) * (2 * cov + c2)) / den)
    return float(np.mean(acc)) if acc else 0.0


def downsample(rgb: np.ndarray, max_w: int = 480) -> np.ndarray:
    h, w = rgb.shape[:2]
    if w <= max_w:
        return rgb
    scale = max_w / w
    img = Image.fromarray(rgb).resize((max_w, max(1, round(h * scale))), Image.Resampling.BILINEAR)
    return np.asarray(img, dtype=np.uint8)


def plot_curves(rows: list[dict], dest: Path) -> None:
    times = [r["t"] for r in rows]
    maes = [r["pair_mae"] for r in rows]
    dest_ssims = [r["dest_ssim"] for r in rows]
    w, h = 1100, 420
    img = Image.new("RGB", (w, h), (18, 18, 18))
    draw = ImageDraw.Draw(img)
    pad_l, pad_r, pad_t, pad_b = 60, 30, 30, 40
    plot_w = w - pad_l - pad_r
    plot_h = h - pad_t - pad_b
    tmax = max(times) or 1.0
    mae_max = max(maes) if maes else 1.0
    mae_max = max(mae_max, 1.0)

    def x_of(t: float) -> int:
        return pad_l + int(t / tmax * plot_w)

    def y_mae(v: float) -> int:
        return pad_t + int((1.0 - v / mae_max) * plot_h)

    def y_ssim(v: float) -> int:
        return pad_t + int((1.0 - v) * plot_h)

    draw.rectangle([pad_l, pad_t, pad_l + plot_w, pad_t + plot_h], outline=(70, 70, 70))
    for i in range(1, len(rows)):
        draw.line([(x_of(times[i - 1]), y_mae(maes[i - 1])), (x_of(times[i]), y_mae(maes[i]))], fill=(80, 180, 255), width=2)
        draw.line(
            [(x_of(times[i - 1]), y_ssim(dest_ssims[i - 1])), (x_of(times[i]), y_ssim(dest_ssims[i]))],
            fill=(255, 180, 70),
            width=2,
        )
    draw.text((pad_l, 8), "blue=pair MAE (motion)   orange=dest SSIM", fill=(220, 220, 220))
    dest.parent.mkdir(parents=True, exist_ok=True)
    img.save(dest)


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--video", required=True, type=Path)
    parser.add_argument("--dest", required=True, type=Path, help="pristine canonical destination still")
    parser.add_argument("--out", required=True, type=Path)
    parser.add_argument("--sample-every", type=int, default=12, help="save a preview frame every N frames")
    args = parser.parse_args()
    out = args.out
    out.mkdir(parents=True, exist_ok=True)
    (out / "samples").mkdir(parents=True, exist_ok=True)
    frames, meta = decode(args.video)
    dest_full = np.asarray(Image.open(args.dest).convert("RGB"), dtype=np.uint8)
    dest_fitted = None
    dest_gray = None

    rows = []
    prev_small = None
    for i, frame in enumerate(frames):
        small = downsample(frame)
        if dest_fitted is None or dest_fitted.shape != small.shape:
            dest_fitted = np.asarray(
                Image.fromarray(dest_full).resize((small.shape[1], small.shape[0]), Image.Resampling.BILINEAR),
                dtype=np.uint8,
            )
            dest_gray = dest_fitted.mean(axis=2)
        dest_small = dest_fitted
        gray = small.mean(axis=2)
        dest_mae = float(np.mean(np.abs(small.astype(np.float64) - dest_small.astype(np.float64))))
        dest_ssim = ssim_gray(gray, dest_gray)
        if prev_small is None:
            pair_mae = 0.0
        else:
            pair_mae = float(np.mean(np.abs(small.astype(np.float64) - prev_small.astype(np.float64))))
        prev_small = small
        t = i / meta["fps"]
        rows.append(
            {
                "index": i,
                "t": round(t, 4),
                "pair_mae": pair_mae,
                "dest_mae": dest_mae,
                "dest_ssim": dest_ssim,
                "luma": float(frame.astype(np.float64).mean()),
            }
        )
        if i % args.sample_every == 0 or i == len(frames) - 1:
            Image.fromarray(frame).save(out / "samples" / f"frame-{i:04d}.png")

    (out / "motion.csv").write_text(
        "index,t,pair_mae,dest_mae,dest_ssim,luma\n"
        + "".join(
            f"{r['index']},{r['t']},{r['pair_mae']:.6f},{r['dest_mae']:.6f},{r['dest_ssim']:.6f},{r['luma']:.4f}\n"
            for r in rows
        )
    )
    plot_curves(rows, out / "motion.png")
    peak = max(r["pair_mae"] for r in rows[1:]) if len(rows) > 1 else 0.0
    # heuristic annotations only — selection remains manual
    dest_ready = next((r for r in rows if r["dest_ssim"] >= 0.55 and r["t"] >= 1.0), None)
    lock = None
    if dest_ready:
        after = [r for r in rows if r["index"] >= dest_ready["index"]]
        for r in after:
            if r["pair_mae"] < max(2.5, 0.35 * peak) and r["dest_ssim"] >= dest_ready["dest_ssim"] - 0.05:
                lock = r
                break
    (out / "curve.json").write_text(
        json.dumps(
            {
                "video": str(args.video),
                "dest": str(args.dest),
                "meta": meta,
                "peak_pair_mae": peak,
                "heuristic_dest_established": dest_ready,
                "heuristic_pose_lock_start": lock,
                "last": rows[-1],
                "note": PYTHON_NOTE,
            },
            indent=2,
        )
        + "\n"
    )
    print(json.dumps({"frames": len(rows), "peak_pair_mae": peak, "out": str(out)}, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
