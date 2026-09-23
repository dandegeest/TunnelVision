#!/usr/bin/env python3
"""Hybrid endpoint-inheritance analysis: seams, destinations, sheets, concat."""

from __future__ import annotations

import json
import math
import shutil
import subprocess
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageFont

EXP = Path(__file__).resolve().parent / "TheLongWayDown"
GEN = EXP / "generated"
STILLS = EXP / "stills"
SHEETS = EXP / "sheets"
CLIPS = GEN / "seam-clips"
MOVIE = GEN / "experimental_A_B_C_D_E_hybrid_endpoint_inheritance.mp4"

SEAMS = [
    ("B", "A-B", "Be", "B-C", "Bs_rendered"),
    ("C", "B-C", "Ce", "C-D", "Cs_rendered"),
    ("D", "C-D", "De", "D-E", "Ds_rendered"),
]
DESTS = [
    ("B", "Be", "A-B"),
    ("C", "Ce", "B-C"),
    ("D", "De", "C-D"),
    ("E", "Ee", "D-E"),
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
            mu_a = pa.mean()
            mu_b = pb.mean()
            var_a = pa.var()
            var_b = pb.var()
            cov = ((pa - mu_a) * (pb - mu_b)).mean()
            num = (2 * mu_a * mu_b + c1) * (2 * cov + c2)
            den = (mu_a**2 + mu_b**2 + c1) * (var_a + var_b + c2)
            acc.append(num / den)
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
    a_f = a.astype(np.float64)
    b_f = b.astype(np.float64)
    diff = a_f - b_f
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
        "luma_a": float(a_f.mean()),
        "luma_b": float(b_f.mean()),
    }


def sharpness(frame: np.ndarray) -> float:
    gray = frame.astype(np.float64).mean(axis=2)
    return float(
        np.mean(
            np.abs(
                gray[1:-1, 1:-1] * 4
                - gray[:-2, 1:-1]
                - gray[2:, 1:-1]
                - gray[1:-1, :-2]
                - gray[1:-1, 2:]
            )
        )
    )


def state_quality(path: Path) -> dict:
    arr = load(path)
    return {
        "path": str(path.relative_to(EXP.parent.parent.parent.parent) if False else path),
        "width": int(arr.shape[1]),
        "height": int(arr.shape[0]),
        "luma": float(arr.astype(np.float64).mean()),
        "sharpness": sharpness(arr),
    }


def fit_cover(src: Image.Image, size: tuple[int, int]) -> Image.Image:
    tw, th = size
    sw, sh = src.size
    scale = max(tw / sw, th / sh)
    nw = max(1, round(sw * scale))
    nh = max(1, round(sh * scale))
    resized = src.resize((nw, nh), Image.Resampling.LANCZOS)
    x = (nw - tw) // 2
    y = (nh - th) // 2
    return resized.crop((x, y, x + tw, y + th))


def diff_image(a: np.ndarray, b: np.ndarray) -> Image.Image:
    a, b = crop_common(a, b)
    mag = np.abs(a.astype(np.int16) - b.astype(np.int16)).astype(np.float64).max(axis=2)
    mag = np.clip(mag * 4.0, 0, 255).astype(np.uint8)
    heat = np.stack([mag, np.zeros_like(mag), 255 - mag], axis=2)
    return Image.fromarray(heat)


def font(size: int) -> ImageFont.ImageFont:
    for path in (
        "/System/Library/Fonts/Supplemental/Arial.ttf",
        "/System/Library/Fonts/Helvetica.ttc",
    ):
        try:
            return ImageFont.truetype(path, size)
        except OSError:
            continue
    return ImageFont.load_default()


def labeled_row(images: list[tuple[str, Image.Image]], thumb_h: int = 320) -> Image.Image:
    thumbs = []
    for title, img in images:
        scale = thumb_h / img.height
        tw = max(1, round(img.width * scale))
        thumbs.append((title, img.resize((tw, thumb_h), Image.Resampling.LANCZOS)))
    gap = 12
    label_h = 36
    width = sum(t.width for _, t in thumbs) + gap * (len(thumbs) + 1)
    canvas = Image.new("RGB", (width, thumb_h + label_h + gap * 2), (16, 16, 16))
    draw = ImageDraw.Draw(canvas)
    f = font(18)
    x = gap
    y = gap
    for title, thumb in thumbs:
        canvas.paste(thumb, (x, y))
        draw.text((x, y + thumb_h + 6), title, fill=(230, 230, 230), font=f)
        x += thumb.width + gap
    return canvas


def stack(rows: list[Image.Image], title: str) -> Image.Image:
    gap = 16
    title_h = 48
    width = max(r.width for r in rows) + gap * 2
    height = title_h + sum(r.height for r in rows) + gap * (len(rows) + 1)
    canvas = Image.new("RGB", (width, height), (8, 8, 8))
    draw = ImageDraw.Draw(canvas)
    draw.text((gap, 12), title, fill=(255, 255, 255), font=font(24))
    y = title_h
    for row in rows:
        canvas.paste(row, ((width - row.width) // 2, y))
        y += row.height + gap
    return canvas


def promote_endpoints() -> None:
    de = GEN / "D-E"
    shutil.copy2(de / "frames" / "last_literal.png", de / "Ee_literal.png")
    shutil.copy2(de / "frames" / "last_literal.png", de / "Ee_selected.png")
    shutil.copy2(de / "frames" / "last_literal.png", de / "Ee.png")
    (de / "selection.json").write_text(
        json.dumps(
            {
                "Ee_literal": "frame 241/242",
                "Ee_selected": "same",
                "reason": (
                    "Literal last frame is the abandoned station: clock, columns, "
                    "tracks, dark tunnel. Matches canonical E. Near-end MAE is "
                    "low (freeze/magnetism toward E) but not a decode glitch."
                ),
                "camotion": False,
            },
            indent=2,
        )
        + "\n"
    )
    shutil.copy2(GEN / "B-C" / "frames" / "first.png", GEN / "B-C" / "Bs_rendered.png")
    shutil.copy2(GEN / "C-D" / "frames" / "first.png", GEN / "C-D" / "Cs_rendered.png")
    shutil.copy2(GEN / "D-E" / "frames" / "first.png", GEN / "D-E" / "Ds_rendered.png")


def concat_movie() -> dict:
    CLIPS.mkdir(parents=True, exist_ok=True)
    target_w, target_h = 1932, 1072
    scaled = []
    for leg in ("A-B", "B-C", "C-D", "D-E"):
        src = GEN / leg / f"{leg}.mp4"
        out = GEN / leg / f"{leg}-scaled.mp4"
        subprocess.run(
            [
                "ffmpeg",
                "-hide_banner",
                "-loglevel",
                "error",
                "-y",
                "-i",
                str(src),
                "-vf",
                f"scale={target_w}:{target_h}:flags=bicubic,setsar=1",
                "-c:v",
                "libx264",
                "-crf",
                "18",
                "-preset",
                "veryfast",
                "-pix_fmt",
                "yuv420p",
                "-an",
                str(out),
            ],
            check=True,
        )
        scaled.append(out)
    list_path = GEN / "concat.txt"
    list_path.write_text("".join(f"file '{p}'\n" for p in scaled))
    subprocess.run(
        [
            "ffmpeg",
            "-hide_banner",
            "-loglevel",
            "error",
            "-y",
            "-f",
            "concat",
            "-safe",
            "0",
            "-i",
            str(list_path),
            "-c",
            "copy",
            str(MOVIE),
        ],
        check=True,
    )
    for incoming, outgoing, letter in (("A-B", "B-C", "B"), ("B-C", "C-D", "C"), ("C-D", "D-E", "D")):
        a = GEN / incoming / f"{incoming}-scaled.mp4"
        b = GEN / outgoing / f"{outgoing}-scaled.mp4"
        clip = CLIPS / f"seam-{letter}.mp4"
        subprocess.run(
            [
                "ffmpeg",
                "-hide_banner",
                "-loglevel",
                "error",
                "-y",
                "-i",
                str(a),
                "-i",
                str(b),
                "-filter_complex",
                "[0:v]trim=start=8.5:duration=1.58,setpts=PTS-STARTPTS[a];"
                "[1:v]trim=start=0:duration=1.58,setpts=PTS-STARTPTS[b];"
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
                str(clip),
            ],
            check=True,
        )
    return {"movie": str(MOVIE), "seams": [str(CLIPS / f"seam-{x}.mp4") for x in "BCD"]}


def main() -> int:
    SHEETS.mkdir(parents=True, exist_ok=True)
    promote_endpoints()

    metrics: dict = {
        "experiment": "hybrid-endpoint-inheritance",
        "model": "kwaivgi/kling-v2.5-turbo-pro",
        "start_only_control": {
            "B": {"ssim": 0.932, "mae": 3.14, "psnr_db": 33.4, "histogram_correlation": 0.945},
            "C": {"ssim": 0.926, "mae": 1.01, "psnr_db": 42.9, "histogram_correlation": 0.990},
            "D": {"ssim": 0.927, "mae": 2.62, "psnr_db": 37.9, "histogram_correlation": 0.973},
        },
        "legs": {},
        "seams": {},
        "destinations": {},
        "state_quality": {},
    }

    for letter, incoming, end_name, outgoing, first_name in SEAMS:
        left = load(GEN / incoming / f"{end_name}.png")
        right = load(GEN / outgoing / f"{first_name}.png")
        m = compare(left, right)
        metrics["seams"][letter] = {
            "incoming": incoming,
            "outgoing": outgoing,
            "comparison": f"{end_name} vs {first_name}",
            **m,
        }
        left_img = Image.fromarray(left)
        right_img = Image.fromarray(right)
        heat = diff_image(left, right)
        heat.save(SHEETS / f"seam-{letter}-diff.png")
        labeled_row(
            [
                (f"{end_name} (inherited start)", left_img),
                (f"{first_name} (next first frame)", right_img),
                ("|diff| x4", heat),
            ]
        ).save(SHEETS / f"seam-{letter}.png")

    for canon, rendered, leg in DESTS:
        dest = load(STILLS / f"{canon}.png")
        arr = load(GEN / leg / f"{rendered}.png")
        fitted = np.asarray(fit_cover(Image.fromarray(dest), (arr.shape[1], arr.shape[0])), dtype=np.uint8)
        m = compare(fitted, arr)
        metrics["destinations"][canon] = {
            "canonical": f"stills/{canon}.png",
            "rendered": f"generated/{leg}/{rendered}.png",
            "note": "pixel metrics after cover-fit of canonical onto rendered size; semantic judgement is primary",
            **m,
        }
        heat = diff_image(fitted, arr)
        heat.save(SHEETS / f"dest-{canon}-diff.png")
        labeled_row(
            [
                (f"canonical {canon}", Image.fromarray(fitted)),
                (rendered, Image.fromarray(arr)),
                ("|diff| x4", heat),
            ]
        ).save(SHEETS / f"dest-{canon}.png")

    story_pairs = [
        ("A′ (Camotion launch)", STILLS / "A-prime.png"),
        ("canonical B", STILLS / "B.png"),
        ("Be (rendered)", GEN / "A-B" / "Be.png"),
        ("canonical C", STILLS / "C.png"),
        ("Ce (rendered)", GEN / "B-C" / "Ce.png"),
        ("canonical D", STILLS / "D.png"),
        ("De (rendered)", GEN / "C-D" / "De.png"),
        ("canonical E", STILLS / "E.png"),
        ("Ee (rendered)", GEN / "D-E" / "Ee.png"),
    ]
    rows = []
    for i in range(0, len(story_pairs), 3):
        chunk = story_pairs[i : i + 3]
        rows.append(labeled_row([(t, Image.open(p).convert("RGB")) for t, p in chunk]))
    stack(rows, "HYBRID story / destination  —  intended canonical vs actual arrival").save(
        SHEETS / "story-destination.png"
    )

    for key, path in (
        ("A-prime", STILLS / "A-prime.png"),
        ("B-canonical", STILLS / "B.png"),
        ("Be", GEN / "A-B" / "Be.png"),
        ("C-canonical", STILLS / "C.png"),
        ("Ce", GEN / "B-C" / "Ce.png"),
        ("D-canonical", STILLS / "D.png"),
        ("De", GEN / "C-D" / "De.png"),
        ("E-canonical", STILLS / "E.png"),
        ("Ee", GEN / "D-E" / "Ee.png"),
    ):
        q = state_quality(path)
        q["path"] = str(path.relative_to(EXP.parent.parent.parent.parent))
        metrics["state_quality"][key] = q

    for leg in ("A-B", "B-C", "C-D", "D-E"):
        gen = json.loads((GEN / leg / "generation.json").read_text())
        ext = json.loads((GEN / leg / "frames" / "extract.json").read_text())
        metrics["legs"][leg] = {
            "wallMs": gen.get("wallMs"),
            "elapsedMs": gen.get("result", {}).get("elapsedMs"),
            "predictionId": gen.get("result", {}).get("predictionId"),
            "durationRequested": gen.get("durationRequested"),
            "camotionOnStart": gen.get("camotionOnStart"),
            "startImage": gen.get("startImage"),
            "endImage": gen.get("endImage"),
            "video": {
                "width": ext["width"],
                "height": ext["height"],
                "duration": ext["duration"],
                "decoded_frames": ext["decoded_frames"],
                "window": ext["window"],
            },
        }

    media = concat_movie()
    metrics["outputs"] = media
    (GEN / "metrics.json").write_text(json.dumps(metrics, indent=2) + "\n")
    print(json.dumps({"seams": metrics["seams"], "destinations": {k: {kk: vv for kk, vv in v.items() if kk in ("ssim", "mae", "psnr_db", "histogram_correlation")} for k, v in metrics["destinations"].items()}, "outputs": media}, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
