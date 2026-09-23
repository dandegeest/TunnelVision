#!/usr/bin/env python3
"""Static + kinetic analysis for hybrid + canonical-derived Camotion."""

from __future__ import annotations

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
STILLS = EXP / "stills"
SHEETS = EXP / "sheets"
CLIPS = GEN / "clips"
CTRL = REPO / "docs/experiments/2026-09-22-hybrid-endpoint-inheritance/TheLongWayDown/generated"
MOVIE = GEN / "experimental_A_B_C_D_E_hybrid_canonical_camotion.mp4"
SIDE = GEN / "control_vs_experiment_side_by_side.mp4"

CONTROL = {
    "B": {"ssim": 0.777, "mae": 6.28, "psnr_db": 27.2, "histogram_correlation": 0.791},
    "C": {"ssim": 0.936, "mae": 3.57, "psnr_db": 34.7, "histogram_correlation": 0.978},
    "D": {"ssim": 0.933, "mae": 3.75, "psnr_db": 34.4, "histogram_correlation": 0.984},
}


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


def probe_decode(path: Path) -> np.ndarray:
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
    w, h = int(stream["width"]), int(stream["height"])
    raw = subprocess.check_output(
        ["ffmpeg", "-hide_banner", "-loglevel", "error", "-i", str(path), "-f", "rawvideo", "-pix_fmt", "rgb24", "pipe:1"]
    )
    n = len(raw) // (w * h * 3)
    return np.frombuffer(raw, dtype=np.uint8).reshape((n, h, w, 3)).copy()


def pair_mae(frames: np.ndarray) -> list[float]:
    out = []
    for i in range(1, len(frames)):
        out.append(float(np.mean(np.abs(frames[i].astype(np.float64) - frames[i - 1].astype(np.float64)))))
    return out


def block_flow(a: np.ndarray, b: np.ndarray, block: int = 16, search: int = 8) -> tuple[float, float, float]:
    """Cheap block-match flow. Returns mean |v|, mean dx, mean dy."""
    ga = a.astype(np.float64).mean(axis=2)
    gb = b.astype(np.float64).mean(axis=2)
    h, w = ga.shape
    dxs, dys, mags = [], [], []
    for y in range(search, h - block - search, block):
        for x in range(search, w - block - search, block):
            pa = ga[y : y + block, x : x + block]
            best = 1e18
            bdx = bdy = 0
            for dy in range(-search, search + 1, 2):
                for dx in range(-search, search + 1, 2):
                    pb = gb[y + dy : y + dy + block, x + dx : x + dx + block]
                    err = float(np.mean(np.abs(pa - pb)))
                    if err < best:
                        best = err
                        bdx, bdy = dx, dy
            dxs.append(bdx)
            dys.append(bdy)
            mags.append(math.hypot(bdx, bdy))
    if not mags:
        return 0.0, 0.0, 0.0
    return float(np.mean(mags)), float(np.mean(dxs)), float(np.mean(dys))


def window_motion(frames: np.ndarray) -> dict:
    maes = pair_mae(frames)
    flows = [block_flow(frames[i - 1], frames[i]) for i in range(1, len(frames))]
    return {
        "n": int(len(frames)),
        "mean_pair_mae": float(np.mean(maes)) if maes else 0.0,
        "min_pair_mae": float(np.min(maes)) if maes else 0.0,
        "max_pair_mae": float(np.max(maes)) if maes else 0.0,
        "pair_mae": maes,
        "mean_flow_mag": float(np.mean([f[0] for f in flows])) if flows else 0.0,
        "mean_flow_dx": float(np.mean([f[1] for f in flows])) if flows else 0.0,
        "mean_flow_dy": float(np.mean([f[2] for f in flows])) if flows else 0.0,
    }


def font(size: int) -> ImageFont.ImageFont:
    for path in ("/System/Library/Fonts/Supplemental/Arial.ttf", "/System/Library/Fonts/Helvetica.ttc"):
        try:
            return ImageFont.truetype(path, size)
        except OSError:
            continue
    return ImageFont.load_default()


def labeled_row(images: list[tuple[str, Image.Image]], thumb_h: int = 300) -> Image.Image:
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


def scale_clip(src: Path, dest: Path, w: int = 1932, h: int = 1072) -> None:
    ff("-i", str(src), "-vf", f"scale={w}:{h}:flags=bicubic,setsar=1", "-c:v", "libx264", "-crf", "18", "-preset", "veryfast", "-pix_fmt", "yuv420p", "-an", str(dest))


def seam_clip(incoming: Path, outgoing: Path, dest: Path, pre: float = 1.5, post: float = 1.5) -> None:
    ff(
        "-i",
        str(incoming),
        "-i",
        str(outgoing),
        "-filter_complex",
        f"[0:v]trim=start={10.08-pre}:duration={pre},setpts=PTS-STARTPTS[a];"
        f"[1:v]trim=start=0:duration={post},setpts=PTS-STARTPTS[b];"
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


def hstack(left: Path, right: Path, dest: Path, left_label: str, right_label: str) -> None:
    ff(
        "-i",
        str(left),
        "-i",
        str(right),
        "-filter_complex",
        f"[0:v]scale=960:534,setsar=1,drawtext=fontfile=/System/Library/Fonts/Supplemental/Arial.ttf:text='{left_label}':fontcolor=white:fontsize=22:x=12:y=12:box=1:boxcolor=black@0.6[a];"
        f"[1:v]scale=960:534,setsar=1,drawtext=fontfile=/System/Library/Fonts/Supplemental/Arial.ttf:text='{right_label}':fontcolor=white:fontsize=22:x=12:y=12:box=1:boxcolor=black@0.6[b];"
        "[a][b]hstack=inputs=2[v]",
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


def promote() -> None:
    de = GEN / "D-E"
    shutil.copy2(de / "frames" / "last_literal.png", de / "Ee_literal.png")
    shutil.copy2(de / "frames" / "last_literal.png", de / "Ee_selected.png")
    shutil.copy2(de / "frames" / "last_literal.png", de / "Ee.png")
    shutil.copy2(de / "frames" / "first.png", de / "Ds_rendered.png")
    (de / "selection.json").write_text(
        json.dumps(
            {
                "Ee_literal": "frame 241/242",
                "Ee_selected": "same",
                "reason": "Abandoned station: clock, columns, tracks. Matches canonical E.",
                "camotionOnStart": "canonical D-E startPlan applied to De",
            },
            indent=2,
        )
        + "\n"
    )


def main() -> int:
    SHEETS.mkdir(parents=True, exist_ok=True)
    CLIPS.mkdir(parents=True, exist_ok=True)
    promote()

    metrics: dict = {
        "experiment": "hybrid-canonical-camotion",
        "control": CONTROL,
        "camotion_transform": {},
        "rendered_seams": {},
        "kinetic": {},
        "destinations": {},
        "state_quality": {},
        "legs": {},
    }

    pairs = [
        ("B", "A-B", "Be", "B-C", "Bs-prime", "Bs_rendered"),
        ("C", "B-C", "Ce", "C-D", "Cs-prime", "Cs_rendered"),
        ("D", "C-D", "De", "D-E", "Ds-prime", "Ds_rendered"),
    ]
    for letter, incoming, end_name, outgoing, primed, rendered in pairs:
        inherited = load(GEN / incoming / f"{end_name}.png")
        prime = load(GEN / outgoing / f"{primed}.png")
        first = load(GEN / outgoing / f"{rendered}.png")
        t = compare(inherited, prime)
        s = compare(inherited, first)
        p2s = compare(prime, first)
        metrics["camotion_transform"][letter] = {**t, "pair": f"{end_name} vs {primed}"}
        metrics["rendered_seams"][letter] = {**s, "pair": f"{end_name} vs {rendered}", "prime_vs_rendered": p2s}
        heat_t = diff_image(inherited, prime)
        heat_s = diff_image(inherited, first)
        labeled_row(
            [
                (end_name, Image.fromarray(inherited)),
                (primed, Image.fromarray(prime)),
                ("|diff| x4", heat_t),
            ]
        ).save(SHEETS / f"camotion-{letter}.png")
        labeled_row(
            [
                (end_name, Image.fromarray(inherited)),
                (rendered, Image.fromarray(first)),
                ("|diff| x4", heat_s),
            ]
        ).save(SHEETS / f"seam-{letter}.png")

        inc = probe_decode(GEN / incoming / f"{incoming}.mp4")
        out = probe_decode(GEN / outgoing / f"{outgoing}.mp4")
        last_n = inc[-24:]
        first_n = out[:24]
        kin = {
            "incoming_last_1s": window_motion(last_n),
            "outgoing_first_1s": window_motion(first_n),
        }
        ctrl_inc = probe_decode(CTRL / incoming / f"{incoming}.mp4")
        ctrl_out = probe_decode(CTRL / outgoing / f"{outgoing}.mp4")
        kin["control_incoming_last_1s"] = window_motion(ctrl_inc[-24:])
        kin["control_outgoing_first_1s"] = window_motion(ctrl_out[:24])
        metrics["kinetic"][letter] = kin

        dest = load(STILLS / f"{letter if letter != 'B' else 'B'}.png")
        # destination of this outgoing clip's end
        dest_letter = {"B": "C", "C": "D", "D": "E"}[letter]
        dest_img = load(STILLS / f"{dest_letter}.png")
        end_arr = load(GEN / outgoing / f"{ {'B': 'Ce', 'C': 'De', 'D': 'Ee'}[letter] }.png")
        fitted = dest_img
        if fitted.shape != end_arr.shape:
            fitted = np.asarray(
                Image.fromarray(dest_img).resize((end_arr.shape[1], end_arr.shape[0]), Image.Resampling.LANCZOS),
                dtype=np.uint8,
            )
        metrics["destinations"][dest_letter] = compare(fitted, end_arr)

    for key, path in (
        ("Be", GEN / "A-B" / "Be.png"),
        ("Bs-prime", GEN / "B-C" / "Bs-prime.png"),
        ("Ce", GEN / "B-C" / "Ce.png"),
        ("Cs-prime", GEN / "C-D" / "Cs-prime.png"),
        ("De", GEN / "C-D" / "De.png"),
        ("Ds-prime", GEN / "D-E" / "Ds-prime.png"),
        ("Ee", GEN / "D-E" / "Ee.png"),
    ):
        arr = load(path)
        metrics["state_quality"][key] = {
            "luma": float(arr.astype(np.float64).mean()),
            "sharpness": sharpness(arr),
            "width": int(arr.shape[1]),
            "height": int(arr.shape[0]),
        }

    for leg in ("B-C", "C-D", "D-E"):
        gen = json.loads((GEN / leg / "generation.json").read_text())
        ext = json.loads((GEN / leg / "frames" / "extract.json").read_text())
        metrics["legs"][leg] = {
            "wallMs": gen.get("wallMs"),
            "predictionId": gen.get("result", {}).get("predictionId"),
            "durationRequested": gen.get("durationRequested"),
            "video": {"width": ext["width"], "height": ext["height"], "duration": ext["duration"], "window": ext["window"]},
        }

    labeled_row(
        [
            ("A-prime reused", Image.open(STILLS / "A-prime.png").convert("RGB")),
            ("Be reused", Image.open(GEN / "A-B" / "Be.png").convert("RGB")),
            ("Bs-prime", Image.open(GEN / "B-C" / "Bs-prime.png").convert("RGB")),
        ]
    ).save(SHEETS / "story-B.png")
    labeled_row(
        [
            ("Ce", Image.open(GEN / "B-C" / "Ce.png").convert("RGB")),
            ("Cs-prime", Image.open(GEN / "C-D" / "Cs-prime.png").convert("RGB")),
            ("canonical C", Image.open(STILLS / "C.png").convert("RGB")),
        ]
    ).save(SHEETS / "story-C.png")
    labeled_row(
        [
            ("De", Image.open(GEN / "C-D" / "De.png").convert("RGB")),
            ("Ds-prime", Image.open(GEN / "D-E" / "Ds-prime.png").convert("RGB")),
            ("Ee station", Image.open(GEN / "D-E" / "Ee.png").convert("RGB")),
        ]
    ).save(SHEETS / "story-D-E.png")

    scaled = []
    for leg in ("A-B", "B-C", "C-D", "D-E"):
        src = GEN / leg / f"{leg}.mp4"
        out = GEN / leg / f"{leg}-scaled.mp4"
        scale_clip(src, out)
        scaled.append(out)
    list_path = GEN / "concat.txt"
    list_path.write_text("".join(f"file '{p}'\n" for p in scaled))
    ff("-f", "concat", "-safe", "0", "-i", str(list_path), "-c", "copy", str(MOVIE))

    for incoming, outgoing, letter in (("A-B", "B-C", "B"), ("B-C", "C-D", "C"), ("C-D", "D-E", "D")):
        exp_raw = CLIPS / f"seam-{letter}-raw.mp4"
        exp_mark = CLIPS / f"seam-{letter}.mp4"
        ctrl_raw = CLIPS / f"control-seam-{letter}-raw.mp4"
        ctrl_mark = CLIPS / f"control-seam-{letter}.mp4"
        seam_clip(GEN / incoming / f"{incoming}-scaled.mp4", GEN / outgoing / f"{outgoing}-scaled.mp4", exp_raw)
        mark_cut(exp_raw, exp_mark, 1.5)
        ctrl_in = CTRL / incoming / f"{incoming}.mp4"
        ctrl_out = CTRL / outgoing / f"{outgoing}.mp4"
        c_in_s = CLIPS / f"ctrl-{incoming}-scaled.mp4"
        c_out_s = CLIPS / f"ctrl-{outgoing}-scaled.mp4"
        if not c_in_s.exists():
            scale_clip(ctrl_in, c_in_s)
        if not c_out_s.exists():
            scale_clip(ctrl_out, c_out_s)
        seam_clip(c_in_s, c_out_s, ctrl_raw)
        mark_cut(ctrl_raw, ctrl_mark, 1.5)
        hstack(ctrl_mark, exp_mark, CLIPS / f"compare-seam-{letter}.mp4", "CONTROL no Camotion", "EXPERIMENT Camotion plan")

    # full side-by-side of control vs experiment (scale both to 1932 then hstack 960)
    ctrl_full = CLIPS / "control-full-scaled.mp4"
    if not (CTRL / "experimental_A_B_C_D_E_hybrid_endpoint_inheritance.mp4").exists():
        pass
    scale_clip(CTRL / "experimental_A_B_C_D_E_hybrid_endpoint_inheritance.mp4", ctrl_full)
    hstack(ctrl_full, MOVIE, SIDE, "CONTROL hybrid", "EXPERIMENT + Camotion")

    metrics["outputs"] = {
        "movie": str(MOVIE),
        "side_by_side": str(SIDE),
        "seams": [str(CLIPS / f"compare-seam-{x}.mp4") for x in "BCD"],
    }
    (GEN / "metrics.json").write_text(json.dumps(metrics, indent=2) + "\n")

    summary = {
        "camotion_transform": {k: {kk: v[kk] for kk in ("ssim", "mae", "psnr_db", "histogram_correlation")} for k, v in metrics["camotion_transform"].items()},
        "rendered_seams": {k: {kk: v[kk] for kk in ("ssim", "mae", "psnr_db", "histogram_correlation")} for k, v in metrics["rendered_seams"].items()},
        "kinetic": {
            k: {
                "in_mae": v["incoming_last_1s"]["mean_pair_mae"],
                "out_mae": v["outgoing_first_1s"]["mean_pair_mae"],
                "ctrl_in_mae": v["control_incoming_last_1s"]["mean_pair_mae"],
                "ctrl_out_mae": v["control_outgoing_first_1s"]["mean_pair_mae"],
                "in_flow": v["incoming_last_1s"]["mean_flow_mag"],
                "out_flow": v["outgoing_first_1s"]["mean_flow_mag"],
                "ctrl_in_flow": v["control_incoming_last_1s"]["mean_flow_mag"],
                "ctrl_out_flow": v["control_outgoing_first_1s"]["mean_flow_mag"],
            }
            for k, v in metrics["kinetic"].items()
        },
    }
    print(json.dumps(summary, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
