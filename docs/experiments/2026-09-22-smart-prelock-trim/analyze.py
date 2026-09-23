#!/usr/bin/env python3
"""Smart pre-lock trim of original A′→B′ Camotion takes. Experiment-local."""

from __future__ import annotations

import csv
import json
import math
import shutil
import subprocess
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageFont

REPO = Path(__file__).resolve().parents[3]
EXP = Path(__file__).resolve().parent / "TheLongWayDown"
GEN = EXP / "generated"
SHEETS = EXP / "sheets"
CLIPS = GEN / "clips"
HYB = REPO / "docs/experiments/2026-09-22-hybrid-endpoint-inheritance/TheLongWayDown"
ADP = REPO / "docs/experiments/2026-09-22-adaptive-endpoint-camotion/TheLongWayDown"

# Last generated traveling frame before dest-SSIM snap onto B′/C′/D′/E′.
# Snap = dest_ssim jump ≥ 0.05 toward lock in the final second.
SELECTIONS = {
    "A-B": {"star": 238, "name": "Be", "target": "B-prime.png", "next_start": "B-prime-next.png", "next_video": "B-C"},
    "B-C": {"star": 238, "name": "Ce", "target": "C-prime.png", "next_start": "C-prime-next.png", "next_video": "C-D"},
    "C-D": {"star": 237, "name": "De", "target": "D-prime.png", "next_start": "D-prime-next.png", "next_video": "D-E"},
    "D-E": {"star": 238, "name": "Ee", "target": "E-prime.png", "next_start": None, "next_video": None},
}
LITERAL = 241
FPS = 24.0


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


def row_at(rows: list[dict], index: int) -> dict:
    return next(r for r in rows if r["index"] == index)


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


def labeled_row(images: list[tuple[str, Image.Image]], thumb_h: int = 260) -> Image.Image:
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


def ff(*args: str) -> None:
    subprocess.run(["ffmpeg", "-hide_banner", "-loglevel", "error", "-y", *args], check=True)


def trim_inclusive(video: Path, last_index: int, dest: Path) -> None:
    dest.parent.mkdir(parents=True, exist_ok=True)
    end = (last_index + 1) / FPS
    ff(
        "-i",
        str(video),
        "-t",
        f"{end:.6f}",
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


def concat_list(videos: list[Path], dest: Path) -> None:
    dest.parent.mkdir(parents=True, exist_ok=True)
    lst = dest.with_suffix(".txt")
    lst.write_text("".join(f"file '{p.resolve()}'\n" for p in videos))
    ff("-f", "concat", "-safe", "0", "-i", str(lst), "-c", "copy", str(dest))


def seam(incoming: Path, outgoing: Path, dest: Path, incoming_end: float, pre: float = 1.0, post: float = 1.0) -> None:
    dest.parent.mkdir(parents=True, exist_ok=True)
    start = max(0.0, incoming_end - pre)
    ff(
        "-i",
        str(incoming),
        "-i",
        str(outgoing),
        "-filter_complex",
        f"[0:v]trim=start={start:.4f}:end={incoming_end:.4f},setpts=PTS-STARTPTS,scale=1928:1072:flags=bicubic,setsar=1[a];"
        f"[1:v]trim=start=0:duration={post:.4f},setpts=PTS-STARTPTS,scale=1928:1072:flags=bicubic,setsar=1[b];"
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


def hstack(labeled: list[tuple[str, Path]], dest: Path, width: int = 640, height: int = 356) -> None:
    dest.parent.mkdir(parents=True, exist_ok=True)
    args: list[str] = []
    parts = []
    for i, (title, path) in enumerate(labeled):
        args.extend(["-i", str(path)])
        safe = title.replace(":", "\\:").replace("'", "")
        parts.append(
            f"[{i}:v]scale={width}:{height},setsar=1,"
            f"drawtext=fontfile=/System/Library/Fonts/Supplemental/Arial.ttf:text='{safe}':"
            f"fontcolor=white:fontsize=18:x=10:y=10:box=1:boxcolor=black@0.65[v{i}]"
        )
    filt = ";".join(parts) + ";" + "".join(f"[v{i}]" for i in range(len(labeled))) + f"hstack=inputs={len(labeled)}[v]"
    ff(*args, "-filter_complex", filt, "-map", "[v]", "-c:v", "libx264", "-crf", "18", "-preset", "veryfast", "-pix_fmt", "yuv420p", "-an", str(dest))


def main() -> int:
    SHEETS.mkdir(parents=True, exist_ok=True)
    CLIPS.mkdir(parents=True, exist_ok=True)
    stills = EXP / "stills"
    metrics: dict = {"experiment": "smart-prelock-trim", "kling_generations": 0, "fps": FPS, "legs": {}}
    trimmed = []
    full_scaled = []

    for leg, spec in SELECTIONS.items():
        rows = curve(leg)
        star_i = spec["star"]
        lit = row_at(rows, LITERAL)
        star = row_at(rows, star_i)
        src = GEN / leg / f"{leg}.mp4"
        star_png = GEN / leg / f"{spec['name']}_star.png"
        lit_png = GEN / leg / f"{spec['name']}_literal.png"
        shutil.copy2(GEN / leg / "tail" / f"frame-{star_i}.png", star_png)
        shutil.copy2(GEN / leg / "tail" / f"frame-{LITERAL}.png", lit_png)
        target = load(stills / spec["target"])
        star_im = load(star_png)
        lit_im = load(lit_png)
        vs_target_star = compare(star_im, target)
        vs_target_lit = compare(lit_im, target)
        next_metrics = None
        rendered_next = None
        if spec["next_start"] and spec["next_video"]:
            next_still = load(stills / spec["next_start"])
            first_next = load(GEN / spec["next_video"] / "first.png")
            next_metrics = {
                "star_vs_next_Bprime": compare(star_im, next_still),
                "star_vs_next_first_rendered": compare(star_im, first_next),
                "literal_vs_next_first_rendered": compare(lit_im, first_next),
            }
            rendered_next = first_next
        trim_end = (star_i + 1) / FPS
        full_end = (LITERAL + 1) / FPS
        frames_trimmed = LITERAL - star_i
        seconds_trimmed = frames_trimmed / FPS
        incoming = window_stats(rows, star_i - 24, star_i)
        lock_onset = next((r for r in rows if r["index"] >= 216 and r["dest_ssim"] >= 0.35), lit)

        scaled = GEN / leg / f"{leg}-scaled.mp4"
        ff("-i", str(src), "-vf", "scale=1928:1072:flags=bicubic,setsar=1", "-c:v", "libx264", "-crf", "18", "-preset", "veryfast", "-pix_fmt", "yuv420p", "-an", str(scaled))
        full_scaled.append(scaled)
        cut = GEN / leg / f"{leg}-to-star.mp4"
        trim_inclusive(scaled, star_i, cut)
        trimmed.append(cut)

        labeled_row(
            [
                (f"{spec['name']}*", Image.fromarray(star_im)),
                (f"{spec['name']}_literal", Image.fromarray(lit_im)),
                (spec["target"].replace(".png", ""), Image.fromarray(target)),
            ]
            + ([("next start ′", Image.fromarray(load(stills / spec["next_start"])))] if spec["next_start"] else [])
            + ([("next first decoded", Image.fromarray(rendered_next))] if rendered_next is not None else [])
        ).save(SHEETS / f"{leg}-stills.png")

        metrics["legs"][leg] = {
            "full_duration": rows[-1]["t"] + (1 / FPS),
            "literal": lit,
            "star": star,
            "frames_before_literal": frames_trimmed,
            "seconds_before_literal": seconds_trimmed,
            "trim_end": trim_end,
            "full_end": full_end,
            "incoming_last_1s_to_star": incoming,
            "pose_lock_snap_onset": lock_onset,
            "star_vs_target_prime": vs_target_star,
            "literal_vs_target_prime": vs_target_lit,
            "hard_cut": next_metrics,
            "selection_rule": "latest frame before dest_ssim snap (≥0.05 jump toward lock in final second)",
        }

    concat_list(trimmed, GEN / "experimental_Aprime_Bprime_smart_trim.mp4")
    concat_list(full_scaled, GEN / "original_untrimmed_Aprime_to_Eprime.mp4")

    for seam_leg, incoming_leg, outgoing_leg in (("B", "A-B", "B-C"), ("C", "B-C", "C-D"), ("D", "C-D", "D-E")):
        star_i = SELECTIONS[incoming_leg]["star"]
        star_end = (star_i + 1) / FPS
        lit_end = (LITERAL + 1) / FPS
        inc = GEN / incoming_leg / f"{incoming_leg}.mp4"
        outg = GEN / outgoing_leg / f"{outgoing_leg}.mp4"
        seam(inc, outg, CLIPS / f"original-{seam_leg}-raw.mp4", lit_end)
        seam(inc, outg, CLIPS / f"smart-{seam_leg}-raw.mp4", star_end)
        mark_cut(CLIPS / f"original-{seam_leg}-raw.mp4", CLIPS / f"original-{seam_leg}.mp4", 1.0)
        mark_cut(CLIPS / f"smart-{seam_leg}-raw.mp4", CLIPS / f"smart-{seam_leg}.mp4", 1.0)
        pair = [
            ("original untrimmed", CLIPS / f"original-{seam_leg}.mp4"),
            ("smart pre-lock trim", CLIPS / f"smart-{seam_leg}.mp4"),
        ]
        hstack(pair, CLIPS / f"compare-smart-trim-{seam_leg}.mp4")

    # C is the historically hard seam: add hybrid + adaptive if present
    extra = [
        ("original", CLIPS / "original-C.mp4"),
        ("smart trim", CLIPS / "smart-C.mp4"),
    ]
    hyb_c = HYB / "generated" / "seam-clips" / "seam-C.mp4"
    adp_c = ADP / "generated" / "clips" / "adaptive-C.mp4"
    if hyb_c.exists():
        extra.append(("hybrid inherit", hyb_c))
    if adp_c.exists():
        extra.append(("adaptive+camotion", adp_c))
    if len(extra) >= 3:
        hstack(extra, CLIPS / "compare-C-original-smart-hybrid-adaptive.mp4", width=480, height=266)

    (GEN / "metrics.json").write_text(json.dumps(metrics, indent=2) + "\n")
    print(
        json.dumps(
            {
                "kling": 0,
                "stars": {leg: spec["star"] for leg, spec in SELECTIONS.items()},
                "seconds_trimmed": {leg: (LITERAL - spec["star"]) / FPS for leg, spec in SELECTIONS.items()},
                "hard_cut_ssim": {
                    leg: metrics["legs"][leg]["hard_cut"]["star_vs_next_first_rendered"]["ssim"]
                    if metrics["legs"][leg]["hard_cut"]
                    else None
                    for leg in SELECTIONS
                },
            },
            indent=2,
        )
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
