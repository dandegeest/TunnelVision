#!/usr/bin/env python3
"""Forensic endpoint analysis of the committed forest A→F Seedance clips.

Read-only on existing evidence. Decodes sequentially (no timestamp seek).
Does not generate images/videos, alter Camotion, or rewrite source files.
"""

from __future__ import annotations

import hashlib
import json
import math
import subprocess
import sys
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parents[1]
SHOOTING = ROOT / "shooting"
VIDEOS = ROOT / "videos"
OUT = Path(__file__).resolve().parent
FRAMES = OUT / "frames"
SHEETS = OUT / "contact-sheets"
FITTED = OUT / "fitted-references"

LEGS = [
    {"id": "A-B", "start": "A", "end": "B"},
    {"id": "B-C", "start": "B", "end": "C"},
    {"id": "C-D", "start": "C", "end": "D"},
    {"id": "D-E", "start": "D", "end": "E"},
    {"id": "E-F", "start": "E", "end": "F"},
]
WINDOW = 10
THUMB_H = 160
LABEL_H = 22


def sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def run_json(args: list[str]) -> dict:
    result = subprocess.run(args, check=True, capture_output=True, text=True)
    return json.loads(result.stdout)


def probe_video(path: Path) -> dict:
    payload = run_json(
        [
            "ffprobe",
            "-v",
            "error",
            "-print_format",
            "json",
            "-show_format",
            "-show_streams",
            "-show_frames",
            "-select_streams",
            "v:0",
            str(path),
        ]
    )
    stream = next(s for s in payload["streams"] if s["codec_type"] == "video")
    frames = payload.get("frames") or []
    decoded = [f for f in frames if "pts_time" in f or "pkt_pts_time" in f]
    if not decoded:
        decoded = frames
    pts = []
    for frame in decoded:
        raw = frame.get("pts_time") or frame.get("pkt_pts_time")
        if raw is None:
            continue
        pts.append(float(raw))
    r_num, r_den = (int(x) for x in stream["r_frame_rate"].split("/"))
    a_num, a_den = (int(x) for x in stream["avg_frame_rate"].split("/"))
    tb_num, tb_den = (int(x) for x in stream["time_base"].split("/"))
    container_duration = float(payload["format"]["duration"])
    stream_duration = float(stream.get("duration") or container_duration)
    nominal_fps = r_num / r_den
    avg_fps = a_num / a_den
    decoded_count = int(stream.get("nb_frames") or len(pts))
    if pts:
        decoded_count = len(pts)
    implied = decoded_count / nominal_fps if nominal_fps else None
    return {
        "path": str(path.relative_to(ROOT.parent.parent.parent)),
        "codec": stream["codec_name"],
        "pix_fmt": stream.get("pix_fmt"),
        "width": int(stream["width"]),
        "height": int(stream["height"]),
        "profile": stream.get("profile"),
        "r_frame_rate": stream["r_frame_rate"],
        "avg_frame_rate": stream["avg_frame_rate"],
        "nominal_fps": nominal_fps,
        "average_fps": avg_fps,
        "time_base": stream["time_base"],
        "time_base_seconds": tb_num / tb_den,
        "container_duration_s": container_duration,
        "stream_duration_s": stream_duration,
        "nb_frames_container": stream.get("nb_frames"),
        "decoded_frame_count": decoded_count,
        "first_frame_pts_s": pts[0] if pts else None,
        "last_frame_pts_s": pts[-1] if pts else None,
        "implied_duration_framecount_over_fps_s": implied,
        "container_minus_implied_s": (
            None if implied is None else container_duration - implied
        ),
        "last_pts_plus_one_frame_s": (
            None if not pts else pts[-1] + (1.0 / nominal_fps)
        ),
    }


def decode_rgb_frames(path: Path, width: int, height: int) -> np.ndarray:
    """Sequential full-stream decode to RGB uint8. No timestamp seek."""
    frame_bytes = width * height * 3
    proc = subprocess.Popen(
        [
            "ffmpeg",
            "-hide_banner",
            "-loglevel",
            "error",
            "-i",
            str(path),
            "-f",
            "rawvideo",
            "-pix_fmt",
            "rgb24",
            "pipe:1",
        ],
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
    )
    raw, err = proc.communicate()
    if proc.returncode != 0:
        raise RuntimeError(f"ffmpeg decode failed for {path}: {err.decode()}")
    if len(raw) % frame_bytes != 0:
        raise RuntimeError(
            f"{path} decoded {len(raw)} bytes, not a multiple of {frame_bytes}"
        )
    count = len(raw) // frame_bytes
    return np.frombuffer(raw, dtype=np.uint8).reshape((count, height, width, 3)).copy()


def yuv420_roundtrip(rgb: np.ndarray) -> np.ndarray:
    """Chroma-subsample floor: rgb24 → yuv420p → rgb24, no H.264."""
    height, width = rgb.shape[:2]
    proc = subprocess.run(
        [
            "ffmpeg",
            "-hide_banner",
            "-loglevel",
            "error",
            "-f",
            "rawvideo",
            "-pix_fmt",
            "rgb24",
            "-s",
            f"{width}x{height}",
            "-i",
            "pipe:0",
            "-f",
            "rawvideo",
            "-pix_fmt",
            "yuv420p",
            "pipe:1",
        ],
        input=rgb.tobytes(),
        capture_output=True,
        check=True,
    )
    yuv = proc.stdout
    back = subprocess.run(
        [
            "ffmpeg",
            "-hide_banner",
            "-loglevel",
            "error",
            "-f",
            "rawvideo",
            "-pix_fmt",
            "yuv420p",
            "-s",
            f"{width}x{height}",
            "-i",
            "pipe:0",
            "-f",
            "rawvideo",
            "-pix_fmt",
            "rgb24",
            "pipe:1",
        ],
        input=yuv,
        capture_output=True,
        check=True,
    )
    return np.frombuffer(back.stdout, dtype=np.uint8).reshape((height, width, 3)).copy()


def metrics(a: np.ndarray, b: np.ndarray) -> dict:
    if a.shape != b.shape:
        raise ValueError(f"shape mismatch {a.shape} vs {b.shape}")
    a_f = a.astype(np.float64)
    b_f = b.astype(np.float64)
    diff = a_f - b_f
    mae = float(np.mean(np.abs(diff)))
    rmse = float(np.sqrt(np.mean(diff * diff)))
    psnr = float("inf") if rmse == 0 else float(20.0 * math.log10(255.0 / rmse))
    return {
        "exact_equal": bool(np.array_equal(a, b)),
        "max_abs": int(np.max(np.abs(a.astype(np.int16) - b.astype(np.int16)))),
        "mae": mae,
        "rmse": rmse,
        "psnr_db": psnr,
        "ssim": ssim_rgb(a, b),
    }


def ssim_rgb(a: np.ndarray, b: np.ndarray, win: int = 8) -> float:
    """Mean 8×8-block SSIM over RGB channels. No extra dependencies."""
    scores = [ssim_plane(a[:, :, c], b[:, :, c], win) for c in range(3)]
    return float(sum(scores) / 3.0)


def ssim_plane(a: np.ndarray, b: np.ndarray, win: int) -> float:
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
            mu_a = pa.mean()
            mu_b = pb.mean()
            var_a = pa.var()
            var_b = pb.var()
            cov = ((pa - mu_a) * (pb - mu_b)).mean()
            num = (2 * mu_a * mu_b + c1) * (2 * cov + c2)
            den = (mu_a**2 + mu_b**2 + c1) * (var_a + var_b + c2)
            acc.append(num / den)
    return float(np.mean(acc)) if acc else 0.0


def fit_contain(src: Image.Image, size: tuple[int, int]) -> tuple[Image.Image, dict]:
    tw, th = size
    sw, sh = src.size
    scale = min(tw / sw, th / sh)
    nw = max(1, round(sw * scale))
    nh = max(1, round(sh * scale))
    resized = src.resize((nw, nh), Image.Resampling.LANCZOS)
    canvas = Image.new("RGB", (tw, th), (0, 0, 0))
    x = (tw - nw) // 2
    y = (th - nh) // 2
    canvas.paste(resized, (x, y))
    return canvas, {
        "method": "contain_lanczos_center_pad_black",
        "source_size": [sw, sh],
        "target_size": [tw, th],
        "scale": scale,
        "resized_size": [nw, nh],
        "offset": [x, y],
        "pad_wh": [tw - nw, th - nh],
    }


def fit_cover(src: Image.Image, size: tuple[int, int]) -> tuple[Image.Image, dict]:
    tw, th = size
    sw, sh = src.size
    scale = max(tw / sw, th / sh)
    nw = max(1, round(sw * scale))
    nh = max(1, round(sh * scale))
    resized = src.resize((nw, nh), Image.Resampling.LANCZOS)
    x = (nw - tw) // 2
    y = (nh - th) // 2
    cropped = resized.crop((x, y, x + tw, y + th))
    return cropped, {
        "method": "cover_lanczos_center_crop",
        "source_size": [sw, sh],
        "target_size": [tw, th],
        "scale": scale,
        "resized_size": [nw, nh],
        "crop_xy": [x, y],
    }


def fit_stretch(src: Image.Image, size: tuple[int, int]) -> tuple[Image.Image, dict]:
    tw, th = size
    sw, sh = src.size
    stretched = src.resize((tw, th), Image.Resampling.LANCZOS)
    return stretched, {
        "method": "stretch_lanczos_independent_axes",
        "source_size": [sw, sh],
        "target_size": [tw, th],
        "scale_x": tw / sw,
        "scale_y": th / sh,
    }


TRANSFORMS = {
    "contain": fit_contain,
    "cover": fit_cover,
    "stretch": fit_stretch,
}


def as_array(image: Image.Image) -> np.ndarray:
    return np.asarray(image.convert("RGB"), dtype=np.uint8)


def save_png(array: np.ndarray, path: Path) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    Image.fromarray(array, mode="RGB").save(path)


def label_thumb(image: Image.Image, text: str) -> Image.Image:
    w = image.width
    canvas = Image.new("RGB", (w, image.height + LABEL_H), (12, 12, 12))
    canvas.paste(image, (0, 0))
    draw = ImageDraw.Draw(canvas)
    font = ImageFont.load_default()
    draw.text((4, image.height + 5), text, fill=(235, 235, 235), font=font)
    return canvas


def contact_sheet(items: list[tuple[Image.Image, str]], path: Path) -> None:
    thumbs = []
    for image, text in items:
        scaled = image.resize(
            (max(1, round(image.width * THUMB_H / image.height)), THUMB_H),
            Image.Resampling.LANCZOS,
        )
        thumbs.append(label_thumb(scaled, text))
    gap = 4
    width = sum(t.width for t in thumbs) + gap * (len(thumbs) - 1)
    height = thumbs[0].height
    sheet = Image.new("RGB", (width, height), (20, 20, 20))
    x = 0
    for thumb in thumbs:
        sheet.paste(thumb, (x, 0))
        x += thumb.width + gap
    path.parent.mkdir(parents=True, exist_ok=True)
    sheet.save(path)


def closest(rows: list[dict], key: str = "mae") -> dict:
    return min(rows, key=lambda row: row["metrics"][key])


def compare_frame_to_refs(
    frame: np.ndarray,
    shooting: Image.Image,
    fitted_cache: dict[str, tuple[np.ndarray, dict]],
) -> dict:
    native_equal = False
    if shooting.size == (frame.shape[1], frame.shape[0]):
        native_equal = bool(np.array_equal(frame, as_array(shooting)))
    out = {
        "video_size": [int(frame.shape[1]), int(frame.shape[0])],
        "shooting_size": list(shooting.size),
        "native_pixel_identity_possible": shooting.size
        == (frame.shape[1], frame.shape[0]),
        "native_exact_equal": native_equal,
        "transforms": {},
    }
    for name, fn in TRANSFORMS.items():
        if name not in fitted_cache:
            image, info = fn(shooting, (frame.shape[1], frame.shape[0]))
            fitted_cache[name] = (as_array(image), info)
        arr, info = fitted_cache[name]
        row = {"fit": info, "metrics": metrics(frame, arr)}
        if name == "contain":
            roundtrip = yuv420_roundtrip(arr)
            row["vs_yuv420_roundtrip_of_fitted"] = metrics(frame, roundtrip)
        out["transforms"][name] = row
    return out


def window_rows(
    frames: np.ndarray,
    indexes: list[int],
    shooting: Image.Image,
    fitted_cache: dict[str, tuple[np.ndarray, dict]],
) -> list[dict]:
    rows = []
    prev = None
    if "contain" not in fitted_cache:
        image, info = fit_contain(shooting, (frames.shape[2], frames.shape[1]))
        fitted_cache["contain"] = (as_array(image), info)
    contain = fitted_cache["contain"][0]
    for idx in indexes:
        frame = frames[idx]
        vs_prev = None if prev is None else float(
            np.mean(np.abs(frame.astype(np.float64) - prev.astype(np.float64)))
        )
        rows.append(
            {
                "frame_index": idx,
                "vs_prev_mae": vs_prev,
                "metrics": metrics(frame, contain),
            }
        )
        prev = frame
    return rows


def main() -> int:
    FRAMES.mkdir(parents=True, exist_ok=True)
    SHEETS.mkdir(parents=True, exist_ok=True)
    FITTED.mkdir(parents=True, exist_ok=True)

    source_hashes = {}
    for letter in "ABCDEF":
        path = SHOOTING / f"{letter}.png"
        source_hashes[f"shooting/{letter}.png"] = {
            "sha256": sha256_file(path),
            "bytes": path.stat().st_size,
            "size": list(Image.open(path).size),
        }
    for leg in LEGS:
        path = VIDEOS / f"{leg['id']}.mp4"
        source_hashes[f"videos/{leg['id']}.mp4"] = {
            "sha256": sha256_file(path),
            "bytes": path.stat().st_size,
        }

    report = {
        "experiment": "forest-a-to-f-boundary-analysis",
        "note": "Read-only forensic analysis of committed Seedance clips. Sources were not rewritten.",
        "source_hashes": source_hashes,
        "comparison_methods": {
            "contain": "aspect-preserving LANCZOS scale-to-fit, center pad black",
            "cover": "aspect-preserving LANCZOS scale-to-fill, center crop",
            "stretch": "independent-axis LANCZOS resize to exact video WxH",
            "primary_tables": "contain; cover/stretch reported so a closer accidental crop/stretch is not hidden",
            "yuv420_roundtrip": "fitted contain RGB → yuv420p → RGB with ffmpeg, no H.264; chroma-subsample floor only",
        },
        "legs": [],
        "seams": [],
    }

    decoded = {}
    probes = {}
    shooting_images = {
        letter: Image.open(SHOOTING / f"{letter}.png").convert("RGB")
        for letter in "ABCDEF"
    }

    for leg in LEGS:
        video_path = VIDEOS / f"{leg['id']}.mp4"
        probe = probe_video(video_path)
        probes[leg["id"]] = probe
        frames = decode_rgb_frames(video_path, probe["width"], probe["height"])
        if frames.shape[0] != probe["decoded_frame_count"]:
            probe["decoded_frame_count_from_pixels"] = int(frames.shape[0])
        decoded[leg["id"]] = frames

        start_img = shooting_images[leg["start"]]
        end_img = shooting_images[leg["end"]]
        start_cache: dict[str, tuple[np.ndarray, dict]] = {}
        end_cache: dict[str, tuple[np.ndarray, dict]] = {}
        frame0 = compare_frame_to_refs(frames[0], start_img, start_cache)
        final = compare_frame_to_refs(frames[-1], end_img, end_cache)

        for name, (arr, info) in start_cache.items():
            save_png(arr, FITTED / f"{leg['id']}-start-{name}.png")
        for name, (arr, info) in end_cache.items():
            save_png(arr, FITTED / f"{leg['id']}-end-{name}.png")

        start_indexes = list(range(WINDOW))
        end_indexes = list(range(frames.shape[0] - WINDOW, frames.shape[0]))
        start_window = window_rows(frames, start_indexes, start_img, start_cache)
        end_window = window_rows(frames, end_indexes, end_img, end_cache)

        start_dir = FRAMES / leg["id"] / "start"
        end_dir = FRAMES / leg["id"] / "end"
        for idx in start_indexes:
            save_png(frames[idx], start_dir / f"{idx:03d}.png")
        for idx in end_indexes:
            save_png(frames[idx], end_dir / f"{idx:03d}.png")

        start_items = [(start_img, f"supplied {leg['start']}'")] + [
            (Image.fromarray(frames[i], "RGB"), f"frame {i}")
            for i in start_indexes
        ]
        end_items = [
            (Image.fromarray(frames[i], "RGB"), f"frame {i}")
            for i in end_indexes
        ] + [(end_img, f"supplied {leg['end']}'")]
        contact_sheet(start_items, SHEETS / f"{leg['id']}-start.png")
        contact_sheet(end_items, SHEETS / f"{leg['id']}-end.png")

        start_best = closest(start_window)
        end_best = closest(end_window)
        start_hold = [
            row["frame_index"]
            for row in start_window
            if row["metrics"]["mae"] <= start_best["metrics"]["mae"] * 1.15
        ]
        end_hold = [
            row["frame_index"]
            for row in end_window
            if row["metrics"]["mae"] <= end_best["metrics"]["mae"] * 1.15
        ]
        start_static = [
            row
            for row in start_window[1:]
            if row["vs_prev_mae"] is not None and row["vs_prev_mae"] < 2.0
        ]
        end_static = [
            row
            for row in end_window[1:]
            if row["vs_prev_mae"] is not None and row["vs_prev_mae"] < 2.0
        ]

        report["legs"].append(
            {
                "id": leg["id"],
                "start": leg["start"],
                "end": leg["end"],
                "structure": probe,
                "frame0_vs_start": frame0,
                "final_vs_end": final,
                "start_window_contain": start_window,
                "end_window_contain": end_window,
                "start_closest_frame": start_best["frame_index"],
                "end_closest_frame": end_best["frame_index"],
                "start_hold_mae_within_15pct_of_best": start_hold,
                "end_hold_mae_within_15pct_of_best": end_hold,
                "opening_near_duplicate_consecutive_mae_lt_2": [
                    {"to": r["frame_index"], "vs_prev_mae": r["vs_prev_mae"]}
                    for r in start_static
                ],
                "terminal_near_duplicate_consecutive_mae_lt_2": [
                    {"to": r["frame_index"], "vs_prev_mae": r["vs_prev_mae"]}
                    for r in end_static
                ],
            }
        )
        print(
            f"{leg['id']}: {frames.shape[0]} frames {probe['width']}x{probe['height']} "
            f"frame0 contain MAE={frame0['transforms']['contain']['metrics']['mae']:.3f} "
            f"final contain MAE={final['transforms']['contain']['metrics']['mae']:.3f}",
            flush=True,
        )
        del frames

    seams = [("B", "A-B", "B-C"), ("C", "B-C", "C-D"), ("D", "C-D", "D-E"), ("E", "D-E", "E-F")]
    for letter, prev_id, next_id in seams:
        prev_frames = decoded[prev_id]
        next_frames = decoded[next_id]
        prev_last = prev_frames[-1]
        next_first = next_frames[0]
        shooting = shooting_images[letter]
        prev_cache: dict[str, tuple[np.ndarray, dict]] = {}
        next_cache: dict[str, tuple[np.ndarray, dict]] = {}
        prev_vs_s = compare_frame_to_refs(prev_last, shooting, prev_cache)
        next_vs_s = compare_frame_to_refs(next_first, shooting, next_cache)

        # previous-final vs next-first: fit previous into next's canvas (contain/cover/stretch)
        prev_image = Image.fromarray(prev_last, "RGB")
        next_size = (next_first.shape[1], next_first.shape[0])
        seam_direct = None
        if prev_last.shape == next_first.shape:
            seam_direct = metrics(prev_last, next_first)
        seam_fits = {}
        for name, fn in TRANSFORMS.items():
            fitted, info = fn(prev_image, next_size)
            seam_fits[name] = {"fit": info, "metrics": metrics(as_array(fitted), next_first)}

        prev_tail = list(range(prev_frames.shape[0] - 5, prev_frames.shape[0]))
        next_head = list(range(5))
        items = [
            (Image.fromarray(prev_frames[i], "RGB"), f"{prev_id} {i}")
            for i in prev_tail
        ]
        items.append((shooting, f"exact {letter}'"))
        items.extend(
            (Image.fromarray(next_frames[i], "RGB"), f"{next_id} {i}")
            for i in next_head
        )
        contact_sheet(items, SHEETS / f"seam-{letter}.png")

        report["seams"].append(
            {
                "canonical": letter,
                "previous_leg": prev_id,
                "next_leg": next_id,
                "previous_size": [int(prev_last.shape[1]), int(prev_last.shape[0])],
                "next_size": [int(next_first.shape[1]), int(next_first.shape[0])],
                "shooting_size": list(shooting.size),
                "previous_final_vs_shooting": prev_vs_s,
                "next_first_vs_shooting": next_vs_s,
                "previous_final_vs_next_first_same_shape": seam_direct,
                "previous_final_fitted_to_next_first": seam_fits,
            }
        )
        print(f"seam {letter} done", flush=True)

    (OUT / "metrics.json").write_text(json.dumps(report, indent=2) + "\n")
    print(f"wrote {OUT / 'metrics.json'}", flush=True)
    return 0


if __name__ == "__main__":
    sys.exit(main())
