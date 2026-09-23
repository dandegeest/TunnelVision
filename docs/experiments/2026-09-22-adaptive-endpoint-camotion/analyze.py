#!/usr/bin/env python3
"""Static + kinetic analysis for adaptive-endpoint + canonical-derived Camotion."""

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
HYB = REPO / "docs/experiments/2026-09-22-hybrid-endpoint-inheritance/TheLongWayDown/generated"
CAM = REPO / "docs/experiments/2026-09-22-hybrid-canonical-camotion/TheLongWayDown/generated"

HYBRID_STATIC = {
    "B": {"ssim": 0.777, "mae": 6.28, "psnr_db": 27.2, "histogram_correlation": 0.791},
    "C": {"ssim": 0.936, "mae": 3.57, "psnr_db": 34.7, "histogram_correlation": 0.978},
    "D": {"ssim": 0.933, "mae": 3.75, "psnr_db": 34.4, "histogram_correlation": 0.984},
}

# Editorial cuts: last included frame index / timestamp
CUTS = {
    "A-B": {"star": "Be_star", "index": 216, "t": 9.00, "in_video": GEN / "A-B" / "A-B.mp4"},
    "B-C": {"star": "Ce_star", "index": 210, "t": 8.75, "in_video": GEN / "B-C" / "B-C.mp4"},
    "C-D": {"star": "De_star", "index": 216, "t": 9.00, "in_video": GEN / "C-D" / "C-D.mp4"},
    "D-E": {"star": "Ee_star", "index": 204, "t": 8.50, "in_video": GEN / "D-E" / "D-E.mp4"},
}

SEAMS = [
    {
        "letter": "B",
        "incoming": "A-B",
        "outgoing": "B-C",
        "end": GEN / "A-B" / "Be_star.png",
        "prime": GEN / "B-C" / "Bs-prime-star.png",
        "rendered": GEN / "B-C" / "Bs_rendered_star.png",
    },
    {
        "letter": "C",
        "incoming": "B-C",
        "outgoing": "C-D",
        "end": GEN / "B-C" / "Ce_star.png",
        "prime": GEN / "C-D" / "Cs-prime-star.png",
        "rendered": GEN / "C-D" / "Cs_rendered_star.png",
    },
    {
        "letter": "D",
        "incoming": "C-D",
        "outgoing": "D-E",
        "end": GEN / "C-D" / "De_star.png",
        "prime": GEN / "D-E" / "Ds-prime-star.png",
        "rendered": GEN / "D-E" / "Ds_rendered_star.png",
    },
]


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


def curve(leg: str) -> list[dict]:
    rows = list(csv.DictReader((EXP / "curves" / leg / "motion.csv").open()))
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


def trim_to(video: Path, duration: float, dest: Path) -> None:
    dest.parent.mkdir(parents=True, exist_ok=True)
    ff(
        "-i",
        str(video),
        "-t",
        f"{duration:.4f}",
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


def scale_clip(src: Path, dest: Path, w: int = 1932, h: int = 1072) -> None:
    dest.parent.mkdir(parents=True, exist_ok=True)
    ff(
        "-i",
        str(src),
        "-vf",
        f"scale={w}:{h}:flags=bicubic,setsar=1",
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


def label_stack(paths: list[tuple[Path, str]], dest: Path) -> None:
    inputs = []
    filters = []
    for i, (path, label) in enumerate(paths):
        inputs += ["-i", str(path)]
        filters.append(
            f"[{i}:v]scale=640:356,setsar=1,"
            f"drawtext=fontfile=/System/Library/Fonts/Supplemental/Arial.ttf:text='{label}':"
            "fontcolor=white:fontsize=18:x=10:y=10:box=1:boxcolor=black@0.65[v{i}]".format(i=i)
        )
    n = len(paths)
    stack = "".join(f"[v{i}]" for i in range(n)) + f"hstack=inputs={n}[v]"
    ff(*inputs, "-filter_complex", ";".join(filters) + ";" + stack, "-map", "[v]", "-c:v", "libx264", "-crf", "18", "-preset", "veryfast", "-pix_fmt", "yuv420p", "-an", str(dest))


def main() -> int:
    SHEETS.mkdir(parents=True, exist_ok=True)
    CLIPS.mkdir(parents=True, exist_ok=True)

    extract_frame(GEN / "D-E" / "D-E.mp4", 0, GEN / "D-E" / "Ds_rendered_star.png")
    extract_frame(GEN / "D-E" / "D-E.mp4", 241, GEN / "D-E" / "Ee_literal.png")
    extract_frame(GEN / "D-E" / "D-E.mp4", 204, GEN / "D-E" / "Ee_star.png")
    trim_to(GEN / "D-E" / "D-E.mp4", 8.5417, GEN / "D-E" / "D-E-to-Ee-star.mp4")
    (GEN / "D-E" / "selection.json").write_text(
        json.dumps(
            {
                "Ee_literal": {"index": 241, "t": 10.0417, "pair_mae": 1.45, "dest_ssim": 0.933},
                "Ee_star": {"index": 204, "t": 8.50, "pair_mae": 7.24, "dest_ssim": 0.305},
                "full_duration": 10.083333,
                "seconds_removed": 1.5833,
                "percent_removed": 15.70,
                "destination_established_t": 3.0,
                "pose_lock_began_t": 9.0,
                "station_reached": True,
                "reason": "Abandoned station (platform, tracks, clock, columns) established by ~3.0s. Frame 204 is the latest arrival with pair MAE 7.24 before dest-SSIM lock and MAE collapse after 9.0s.",
            },
            indent=2,
        )
        + "\n"
    )

    camotion = {}
    rendered = {}
    kinetic = {}
    dead_tail = {}

    for seam in SEAMS:
        letter = seam["letter"]
        end_arr = load(seam["end"])
        prime_arr = load(seam["prime"])
        rend_arr = load(seam["rendered"])
        camotion[letter] = compare(end_arr, prime_arr)
        camotion[letter]["pair"] = f"{letter}e* vs {letter}s-prime*"
        rendered[letter] = compare(end_arr, rend_arr)
        rendered[letter]["pair"] = f"{letter}e* vs {letter}s_rendered*"
        rendered[letter]["prime_vs_rendered"] = compare(prime_arr, rend_arr)

        Image.fromarray(end_arr).save(SHEETS / f"{letter}e_star.png")
        Image.fromarray(prime_arr).save(SHEETS / f"{letter}s_prime_star.png")
        Image.fromarray(rend_arr).save(SHEETS / f"{letter}s_rendered_star.png")
        diff_image(end_arr, rend_arr).save(SHEETS / f"{letter}-star-seam-diff.png")
        labeled_row(
            [
                (f"{letter}e*", Image.fromarray(end_arr)),
                (f"{letter}s'*", Image.fromarray(prime_arr)),
                (f"{letter}s_rendered*", Image.fromarray(rend_arr)),
                ("|diff| x4", diff_image(end_arr, rend_arr)),
            ]
        ).save(SHEETS / f"{letter}-adaptive-seam.png")

        in_rows = curve(seam["incoming"])
        out_rows = curve(seam["outgoing"])
        in_cut = CUTS[seam["incoming"]]["index"]
        incoming = window_stats(in_rows, in_cut - 24, in_cut)
        outgoing = window_stats(out_rows, 0, 24)
        kinetic[letter] = {
            "incoming_last_1s_to_star": incoming,
            "outgoing_first_1s": outgoing,
            "incoming_mean_mae": incoming["mean_pair_mae"],
            "outgoing_mean_mae": outgoing["mean_pair_mae"],
            "mae_ratio_out_over_in": (
                outgoing["mean_pair_mae"] / incoming["mean_pair_mae"] if incoming["mean_pair_mae"] else None
            ),
        }

        dead_tail[seam["incoming"]] = {
            "full_duration": 10.083333,
            "editorial_t": CUTS[seam["incoming"]]["t"],
            "editorial_index": CUTS[seam["incoming"]]["index"],
            "seconds_removed": 10.083333 - CUTS[seam["incoming"]]["t"],
            "percent_removed": (10.083333 - CUTS[seam["incoming"]]["t"]) / 10.083333 * 100.0,
        }

    dead_tail["D-E"] = {
        "full_duration": 10.083333,
        "editorial_t": 8.50,
        "editorial_index": 204,
        "seconds_removed": 10.083333 - 8.50,
        "percent_removed": (10.083333 - 8.50) / 10.083333 * 100.0,
    }

    # Edited movie through editorial endpoints only
    edited_parts = [
        (GEN / "A-B" / "A-B.mp4", 9.0417, GEN / "A-B" / "A-B-to-Be-star.mp4"),
        (GEN / "B-C" / "B-C.mp4", 8.7917, GEN / "B-C" / "B-C-to-Ce-star.mp4"),
        (GEN / "C-D" / "C-D.mp4", 9.0417, GEN / "C-D" / "C-D-to-De-star.mp4"),
        (GEN / "D-E" / "D-E.mp4", 8.5417, GEN / "D-E" / "D-E-to-Ee-star.mp4"),
    ]
    concat_lines = []
    scaled = []
    for src, dur, dest in edited_parts:
        if not dest.exists():
            trim_to(src, dur, dest)
        scaled_path = dest.with_name(dest.stem + "-scaled.mp4")
        scale_clip(dest, scaled_path)
        scaled.append(scaled_path)
        concat_lines.append(f"file '{scaled_path}'")
    concat = GEN / "concat-adaptive.txt"
    concat.write_text("\n".join(concat_lines) + "\n")
    movie = GEN / "experimental_A_B_C_D_E_adaptive_endpoint_camotion.mp4"
    ff("-f", "concat", "-safe", "0", "-i", str(concat), "-c:v", "libx264", "-crf", "18", "-preset", "veryfast", "-pix_fmt", "yuv420p", "-an", str(movie))

    # Diagnostic full-length concat
    full_parts = [GEN / "A-B" / "A-B.mp4", GEN / "B-C" / "B-C.mp4", GEN / "C-D" / "C-D.mp4", GEN / "D-E" / "D-E.mp4"]
    full_scaled = []
    for src in full_parts:
        dest = src.with_name(src.stem + "-full-scaled.mp4")
        scale_clip(src, dest)
        full_scaled.append(dest)
    (GEN / "concat-full.txt").write_text("\n".join(f"file '{p}'" for p in full_scaled) + "\n")
    ff(
        "-f",
        "concat",
        "-safe",
        "0",
        "-i",
        str(GEN / "concat-full.txt"),
        "-c:v",
        "libx264",
        "-crf",
        "18",
        "-preset",
        "veryfast",
        "-pix_fmt",
        "yuv420p",
        "-an",
        str(GEN / "experimental_A_B_C_D_E_adaptive_full_length_diagnostic.mp4"),
    )

    # Per-boundary three-way seams
    hybrid_map = {"B": ("A-B", "B-C"), "C": ("B-C", "C-D"), "D": ("C-D", "D-E")}
    cam_map = hybrid_map
    adaptive_in = {"B": 9.00, "C": 8.75, "D": 9.00}
    for letter, (inc, outg) in hybrid_map.items():
        hyb_raw = CLIPS / f"hybrid-{letter}-raw.mp4"
        cam_raw = CLIPS / f"camotion-{letter}-raw.mp4"
        adp_raw = CLIPS / f"adaptive-{letter}-raw.mp4"
        seam_from_ends(HYB / inc / f"{inc}.mp4", HYB / outg / f"{outg}.mp4", hyb_raw, 10.08)
        seam_from_ends(CAM / inc / f"{inc}.mp4", CAM / outg / f"{outg}.mp4", cam_raw, 10.08)
        seam_from_ends(GEN / inc / f"{inc}.mp4", GEN / outg / f"{outg}.mp4", adp_raw, adaptive_in[letter])
        hyb_m = CLIPS / f"hybrid-{letter}.mp4"
        cam_m = CLIPS / f"camotion-{letter}.mp4"
        adp_m = CLIPS / f"adaptive-{letter}.mp4"
        mark_cut(hyb_raw, hyb_m, 1.0)
        mark_cut(cam_raw, cam_m, 1.0)
        mark_cut(adp_raw, adp_m, 1.0)
        label_stack(
            [
                (hyb_m, f"A hybrid {letter}"),
                (cam_m, f"B camotion {letter}"),
                (adp_m, f"C adaptive {letter}"),
            ],
            CLIPS / f"threeway-{letter}.mp4",
        )

    # Three-way full movies padded to longest
    hyb_full = HYB / "experimental_A_B_C_D_E_hybrid_endpoint_inheritance.mp4"
    cam_full = CAM / "experimental_A_B_C_D_E_hybrid_canonical_camotion.mp4"
    adp_full = movie
    three = GEN / "threeway_full_hybrid_camotion_adaptive.mp4"
    ff(
        "-i",
        str(hyb_full),
        "-i",
        str(cam_full),
        "-i",
        str(adp_full),
        "-filter_complex",
        "[0:v]scale=640:356,setsar=1,drawtext=fontfile=/System/Library/Fonts/Supplemental/Arial.ttf:text='A hybrid':fontcolor=white:fontsize=20:x=10:y=10:box=1:boxcolor=black@0.65[a];"
        "[1:v]scale=640:356,setsar=1,drawtext=fontfile=/System/Library/Fonts/Supplemental/Arial.ttf:text='B camotion':fontcolor=white:fontsize=20:x=10:y=10:box=1:boxcolor=black@0.65[b];"
        "[2:v]scale=640:356,setsar=1,drawtext=fontfile=/System/Library/Fonts/Supplemental/Arial.ttf:text='C adaptive':fontcolor=white:fontsize=20:x=10:y=10:box=1:boxcolor=black@0.65[c];"
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
        "-shortest",
        str(three),
    )

    discarded = sum(v["seconds_removed"] for v in dead_tail.values())
    generated = 10.083333 * 4
    metrics = {
        "experiment": "adaptive-endpoint-camotion",
        "hybrid_control_static": HYBRID_STATIC,
        "camotion_transform": camotion,
        "rendered_seams": rendered,
        "kinetic": kinetic,
        "dead_tail": dead_tail,
        "footage": {
            "generated_seconds": generated,
            "used_seconds": generated - discarded,
            "discarded_seconds": discarded,
            "discarded_percent": discarded / generated * 100.0,
        },
        "selections": {
            "Be_star": {"index": 216, "t": 9.00},
            "Ce_star": {"index": 210, "t": 8.75},
            "De_star": {"index": 216, "t": 9.00},
            "Ee_star": {"index": 204, "t": 8.50},
        },
        "story": {
            "B": "stairwell / construction — established ~8.0s, cut 9.00s",
            "C": "construction floor / shaft — established ~7.5s, cut 8.75s",
            "D": "utility / brick / cables / steam — established ~6.0s, cut 9.00s",
            "E": "abandoned station — established ~3.0s, cut 8.50s; station reached",
        },
        "movie": str(movie),
        "threeway_full": str(three),
    }
    (GEN / "metrics.json").write_text(json.dumps(metrics, indent=2) + "\n")
    print(json.dumps({"seams": {k: {"ssim": v["ssim"], "mae": v["mae"]} for k, v in rendered.items()}, "kinetic": {k: {"in": v["incoming_mean_mae"], "out": v["outgoing_mean_mae"]} for k, v in kinetic.items()}, "discarded_s": discarded}, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
