#!/usr/bin/env python3
"""Zero-Camotion C→D baseline vs 50% and 100%. Experiment-local."""

from __future__ import annotations

import csv
import json
import math
import subprocess
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageFont

REPO = Path(__file__).resolve().parents[3]
EXP = Path(__file__).resolve().parent / "TheLongWayDown"
GEN = EXP / "generated"
SHEETS = EXP / "sheets"
CLIPS = GEN / "clips"
ADP = REPO / "docs/experiments/2026-09-22-adaptive-endpoint-camotion/TheLongWayDown"
PCT = REPO / "docs/experiments/2026-09-22-camotion-50pct-C-test/TheLongWayDown"


def load(path: Path) -> np.ndarray:
    return np.asarray(Image.open(path).convert("RGB"), dtype=np.uint8)


def crop_common(a: np.ndarray, b: np.ndarray) -> tuple[np.ndarray, np.ndarray]:
    h = min(a.shape[0], b.shape[0])
    w = min(a.shape[1], b.shape[1])
    return a[:h, :w], b[:h, :w]


def ssim_plane(a: np.ndarray, b: np.ndarray, win: int = 8) -> float:
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


def ssim_rgb(a: np.ndarray, b: np.ndarray) -> float:
    return float(sum(ssim_plane(a[:, :, c], b[:, :, c]) for c in range(3)) / 3.0)


def hist_corr(a: np.ndarray, b: np.ndarray) -> float:
    scores = []
    for c in range(3):
        ha = np.histogram(a[:, :, c], bins=256, range=(0, 256))[0].astype(np.float64)
        hb = np.histogram(b[:, :, c], bins=256, range=(0, 256))[0].astype(np.float64)
        ha -= ha.mean()
        hb -= hb.mean()
        den = math.sqrt(float((ha * ha).sum() * (hb * hb).sum()))
        scores.append(0.0 if den == 0 else float((ha * hb).sum() / den))
    return float(sum(scores) / 3.0)


def compare(a: np.ndarray, b: np.ndarray) -> dict:
    a, b = crop_common(a, b)
    diff = a.astype(np.float64) - b.astype(np.float64)
    mae = float(np.mean(np.abs(diff)))
    rmse = float(np.sqrt(np.mean(diff * diff)))
    psnr = float("inf") if rmse == 0 else float(20.0 * math.log10(255.0 / rmse))
    return {
        "width": int(a.shape[1]),
        "height": int(a.shape[0]),
        "mae": mae,
        "rmse": rmse,
        "psnr_db": psnr,
        "ssim": ssim_rgb(a, b),
        "histogram_correlation": hist_corr(a, b),
        "max_abs": int(np.max(np.abs(a.astype(np.int16) - b.astype(np.int16)))),
    }


def curve(path: Path) -> list[dict]:
    rows = list(csv.DictReader(path.open()))
    return [
        {
            "index": int(r["index"]),
            "t": float(r["t"]),
            "pair_mae": float(r["pair_mae"]),
            "dest_ssim": float(r["dest_ssim"]),
        }
        for r in rows
    ]


def window_stats(rows: list[dict], start: int, end: int) -> dict:
    chunk = [r for r in rows if start <= r["index"] <= end]
    maes = [r["pair_mae"] for r in chunk if r["index"] > start]
    return {
        "start": start,
        "end": end,
        "n": len(chunk),
        "mean_pair_mae": float(np.mean(maes)) if maes else 0.0,
        "min_pair_mae": float(np.min(maes)) if maes else 0.0,
        "max_pair_mae": float(np.max(maes)) if maes else 0.0,
        "mean_dest_ssim": float(np.mean([r["dest_ssim"] for r in chunk])) if chunk else 0.0,
    }


def font(size: int) -> ImageFont.ImageFont:
    for path in ("/System/Library/Fonts/Supplemental/Arial.ttf", "/System/Library/Fonts/Helvetica.ttc"):
        try:
            return ImageFont.truetype(path, size)
        except OSError:
            continue
    return ImageFont.load_default()


def labeled_row(images: list[tuple[str, Image.Image]], thumb_h: int = 280) -> Image.Image:
    thumbs = []
    for title, img in images:
        scale = thumb_h / img.height
        tw = max(1, round(img.width * scale))
        thumbs.append((title, img.resize((tw, thumb_h), Image.Resampling.LANCZOS)))
    gap, label_h = 12, 40
    width = sum(t.width for _, t in thumbs) + gap * (len(thumbs) + 1)
    canvas = Image.new("RGB", (width, thumb_h + label_h + gap * 2), (16, 16, 16))
    draw = ImageDraw.Draw(canvas)
    f = font(16)
    x = gap
    for title, thumb in thumbs:
        canvas.paste(thumb, (x, gap))
        draw.text((x, gap + thumb_h + 8), title, fill=(230, 230, 230), font=f)
        x += thumb.width + gap
    return canvas


def diff_image(a: np.ndarray, b: np.ndarray) -> Image.Image:
    a, b = crop_common(a, b)
    mag = np.abs(a.astype(np.int16) - b.astype(np.int16)).astype(np.float64).max(axis=2)
    mag = np.clip(mag * 4.0, 0, 255).astype(np.uint8)
    return Image.fromarray(np.stack([mag, np.zeros_like(mag), 255 - mag], axis=2))


def ff(*args: str) -> None:
    subprocess.run(["ffmpeg", "-hide_banner", "-loglevel", "error", "-y", *args], check=True)


def extract_frame(video: Path, index: int, dest: Path) -> None:
    dest.parent.mkdir(parents=True, exist_ok=True)
    ff("-i", str(video), "-vf", f"select=eq(n\\,{index})", "-vsync", "vfr", str(dest))


def seam_from_ends(incoming: Path, outgoing: Path, dest: Path, incoming_end: float, pre: float = 1.0, post: float = 1.0) -> None:
    dest.parent.mkdir(parents=True, exist_ok=True)
    start = max(0.0, incoming_end - pre)
    ff(
        "-i",
        str(incoming),
        "-i",
        str(outgoing),
        "-filter_complex",
        f"[0:v]trim=start={start:.4f}:end={incoming_end:.4f},setpts=PTS-STARTPTS,scale=1932:1072:flags=bicubic,setsar=1[a];"
        f"[1:v]trim=start=0:duration={post:.4f},setpts=PTS-STARTPTS,scale=1932:1072:flags=bicubic,setsar=1[b];"
        "[a][b]concat=n=2:v=1:a=0[v]",
        "-map",
        "[v]",
        "-c:v",
        "libx264",
        "-crf",
        "18",
        "-preset",
        "veryfast",
        "-pix_fmt",
        "yuv420p",
        "-an",
        str(dest),
    )


def mark_cut(src: Path, dest: Path, cut_at: float) -> None:
    ff(
        "-i",
        str(src),
        "-vf",
        f"drawbox=x=0:y=0:w=iw:h=8:color=yellow@1:t=fill:enable='between(t,{cut_at-0.02},{cut_at+0.08})',"
        f"drawtext=fontfile=/System/Library/Fonts/Supplemental/Arial.ttf:text='CUT':fontcolor=yellow:fontsize=36:x=20:y=20:enable='between(t,{cut_at-0.02},{cut_at+0.4})'",
        "-c:v",
        "libx264",
        "-crf",
        "18",
        "-preset",
        "veryfast",
        "-pix_fmt",
        "yuv420p",
        "-an",
        str(dest),
    )


def fit_response(xs: list[float], ys: list[float]) -> dict:
    x = np.asarray(xs, dtype=np.float64)
    y = np.asarray(ys, dtype=np.float64)
    slope, intercept = np.polyfit(x, y, 1)
    y_hat = intercept + slope * x
    ss_res = float(np.sum((y - y_hat) ** 2))
    ss_tot = float(np.sum((y - y.mean()) ** 2))
    r2 = 1.0 - ss_res / ss_tot if ss_tot else 1.0
    residual_from_linear = {f"{xi:.2f}": float(yi - (intercept + slope * xi)) for xi, yi in zip(x, y)}
    target = 10.0
    implied = None if abs(slope) < 1e-9 else float((target - intercept) / slope)
    return {
        "linear_slope": float(slope),
        "linear_intercept": float(intercept),
        "r2": r2,
        "residual_from_linear": residual_from_linear,
        "implied_strength_for_outgoing_10": implied,
        "kling_baseline_outgoing": float(ys[0]),
        "camotion_added_50": float(ys[1] - ys[0]),
        "camotion_added_100": float(ys[2] - ys[0]),
        "note": "Diagnostic three-point fit only. Not a production mapping.",
    }


def plot_response(path: Path, strengths: list[float], outgoing: list[float], incoming: float) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    w, h, pad = 900, 520, 70
    canvas = Image.new("RGB", (w, h), (18, 18, 18))
    draw = ImageDraw.Draw(canvas)
    f = font(16)
    f_title = font(20)
    xmin, xmax = -0.08, 1.08
    ymin, ymax = 0.0, max(incoming, max(outgoing)) * 1.25
    plot = (pad, 48, w - 24, h - pad)

    def xy(sx: float, sy: float) -> tuple[int, int]:
        px = plot[0] + (sx - xmin) / (xmax - xmin) * (plot[2] - plot[0])
        py = plot[3] - (sy - ymin) / (ymax - ymin) * (plot[3] - plot[1])
        return int(px), int(py)

    draw.rectangle(plot, outline=(80, 80, 80))
    y_in = xy(xmin, incoming)[1]
    draw.line([(plot[0], y_in), (plot[2], y_in)], fill=(140, 140, 140), width=1)
    draw.text((plot[0] + 8, y_in - 18), f"incoming Ce* {incoming:.1f}", fill=(180, 180, 180), font=f)
    pts = [xy(s, o) for s, o in zip(strengths, outgoing)]
    draw.line(pts, fill=(70, 150, 230), width=3)
    for (s, o), (px, py) in zip(zip(strengths, outgoing), pts):
        draw.ellipse((px - 5, py - 5, px + 5, py + 5), fill=(70, 150, 230))
        draw.text((px - 10, py + 10), f"{o:.1f}", fill=(230, 230, 230), font=f)
        draw.text((px - 8, plot[3] + 8), f"{s:.2f}", fill=(200, 200, 200), font=f)
    draw.text((pad, 12), "C seam outgoing pair-MAE vs Camotion strength", fill=(230, 230, 230), font=f_title)
    draw.text((8, h // 2), "MAE", fill=(180, 180, 180), font=f)
    draw.text((w // 2 - 60, h - 28), "Camotion strength", fill=(180, 180, 180), font=f)
    canvas.save(path)


def main() -> int:
    SHEETS.mkdir(parents=True, exist_ok=True)
    CLIPS.mkdir(parents=True, exist_ok=True)

    video = GEN / "C-D" / "C-D.mp4"
    extract_frame(video, 0, GEN / "C-D" / "Cs_rendered_0.png")
    extract_frame(video, 241, GEN / "C-D" / "De_literal.png")
    extract_frame(video, 216, GEN / "C-D" / "sample-9s.png")
    extract_frame(video, 168, GEN / "C-D" / "sample-7s.png")
    extract_frame(video, 120, GEN / "C-D" / "sample-5s.png")

    ce = load(GEN / "Ce_star.png")
    rend0 = load(GEN / "C-D" / "Cs_rendered_0.png")
    rend50 = load(PCT / "generated" / "C-D" / "Cs_rendered_50.png")
    rend100 = load(ADP / "generated" / "C-D" / "Cs_rendered_star.png")

    seam0 = compare(ce, rend0)
    seam50_metrics = compare(ce, rend50)
    seam100_metrics = compare(ce, rend100)

    labeled_row(
        [
            ("Ce*", Image.fromarray(ce)),
            ("Cs_rendered_0", Image.fromarray(rend0)),
            ("Cs_rendered_50", Image.fromarray(rend50)),
            ("Cs_rendered_100", Image.fromarray(rend100)),
        ]
    ).save(SHEETS / "C-0-50-100-stills.png")
    labeled_row(
        [
            ("Ce* vs 0% |diff|x4", diff_image(ce, rend0)),
            ("Ce* vs 50% |diff|x4", diff_image(ce, rend50)),
            ("Ce* vs 100% |diff|x4", diff_image(ce, rend100)),
        ]
    ).save(SHEETS / "C-0-50-100-diffs.png")

    incoming_rows = curve(ADP / "curves" / "B-C" / "motion.csv")
    out0_rows = curve(EXP / "curves" / "C-D" / "motion.csv")
    out50_rows = curve(PCT / "curves" / "C-D" / "motion.csv")
    out100_rows = curve(ADP / "curves" / "C-D" / "motion.csv")
    incoming = window_stats(incoming_rows, 210 - 24, 210)
    out0 = window_stats(out0_rows, 0, 24)
    out0_2s = window_stats(out0_rows, 0, 48)
    out50 = window_stats(out50_rows, 0, 24)
    out100 = window_stats(out100_rows, 0, 24)
    dest0 = window_stats(out0_rows, 180, 241)

    incoming_video = ADP / "generated" / "B-C" / "B-C.mp4"
    seam_from_ends(incoming_video, video, CLIPS / "seam-0-raw.mp4", 8.75)
    mark_cut(CLIPS / "seam-0-raw.mp4", CLIPS / "seam-0.mp4", 1.0)

    seam50_clip = PCT / "generated" / "clips" / "seam-50.mp4"
    seam100_clip = PCT / "generated" / "clips" / "seam-100.mp4"
    if not seam50_clip.exists() or not seam100_clip.exists():
        raise SystemExit("missing 50%/100% seam clips")

    ff(
        "-i",
        str(seam100_clip),
        "-i",
        str(seam50_clip),
        "-i",
        str(CLIPS / "seam-0.mp4"),
        "-filter_complex",
        "[0:v]scale=640:356,setsar=1,drawtext=fontfile=/System/Library/Fonts/Supplemental/Arial.ttf:text='C 100pct':fontcolor=white:fontsize=18:x=10:y=10:box=1:boxcolor=black@0.65[a];"
        "[1:v]scale=640:356,setsar=1,drawtext=fontfile=/System/Library/Fonts/Supplemental/Arial.ttf:text='C 50pct':fontcolor=white:fontsize=18:x=10:y=10:box=1:boxcolor=black@0.65[b];"
        "[2:v]scale=640:356,setsar=1,drawtext=fontfile=/System/Library/Fonts/Supplemental/Arial.ttf:text='C 0pct':fontcolor=white:fontsize=18:x=10:y=10:box=1:boxcolor=black@0.65[c];"
        "[a][b][c]hstack=inputs=3[v]",
        "-map",
        "[v]",
        "-c:v",
        "libx264",
        "-crf",
        "18",
        "-preset",
        "veryfast",
        "-pix_fmt",
        "yuv420p",
        "-an",
        str(CLIPS / "compare-C-100-vs-50-vs-0.mp4"),
    )

    strengths = [0.0, 0.5, 1.0]
    outgoing = [out0["mean_pair_mae"], out50["mean_pair_mae"], out100["mean_pair_mae"]]
    fit = fit_response(strengths, outgoing)
    plot_response(SHEETS / "strength-vs-outgoing-mae.png", strengths, outgoing, incoming["mean_pair_mae"])

    first2 = [
        {"index": r["index"], "t": r["t"], "pair_mae": r["pair_mae"]}
        for r in out0_rows
        if r["index"] <= 48
    ]

    metrics = {
        "experiment": "zero-camotion-C-baseline",
        "kling_generations": 1,
        "ce_star_identity": json.loads((GEN / "ce_star_identity.json").read_text()),
        "incoming_Ce_star_last_1s": incoming,
        "outgoing_0_first_1s": out0,
        "outgoing_0_first_2s": out0_2s,
        "outgoing_50_first_1s": out50,
        "outgoing_100_first_1s": out100,
        "ratio_0": out0["mean_pair_mae"] / incoming["mean_pair_mae"] if incoming["mean_pair_mae"] else None,
        "ratio_50": out50["mean_pair_mae"] / incoming["mean_pair_mae"] if incoming["mean_pair_mae"] else None,
        "ratio_100": out100["mean_pair_mae"] / incoming["mean_pair_mae"] if incoming["mean_pair_mae"] else None,
        "rendered_seams": {"0": seam0, "50": seam50_metrics, "100": seam100_metrics},
        "late_dest_0": dest0,
        "first_2s_curve_0": first2,
        "response_curve": {
            "strengths": strengths,
            "outgoing_first_1s": outgoing,
            "incoming": incoming["mean_pair_mae"],
            "fit": fit,
        },
    }
    (GEN / "metrics.json").write_text(json.dumps(metrics, indent=2) + "\n")
    print(
        json.dumps(
            {
                "in_mae": incoming["mean_pair_mae"],
                "out0_mae": out0["mean_pair_mae"],
                "out50_mae": out50["mean_pair_mae"],
                "out100_mae": out100["mean_pair_mae"],
                "ratio0": metrics["ratio_0"],
                "seam0_ssim": seam0["ssim"],
                "late_dest_mean": dest0["mean_dest_ssim"],
                "fit": fit,
            },
            indent=2,
        )
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
