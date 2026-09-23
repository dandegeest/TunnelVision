#!/usr/bin/env python3
"""Drop decoded frame 0 of every traversal after the first. Experiment-local."""

from __future__ import annotations

import json
import math
import subprocess
from pathlib import Path

import cv2
import numpy as np
from PIL import Image, ImageDraw, ImageFont

REPO = Path(__file__).resolve().parents[3]
EXP = Path(__file__).resolve().parent / "TheLongWayDown"
GEN = EXP / "generated"
FRAMES = GEN / "frames"
DIAG = GEN / "diagnostics"
CLIPS = GEN / "clips"
LEGS = GEN / "legs"

TAKES = {
    "A-B": REPO / "projects/TheLongWayDown/traversals/A-B/take-01.mp4",
    "B-C": REPO / "projects/TheLongWayDown/traversals/B-C/take-01.mp4",
    "C-D": REPO / "projects/TheLongWayDown/traversals/C-D/take-01.mp4",
    "D-E": REPO / "projects/TheLongWayDown/traversals/D-E/take-01.mp4",
}
SEAMS = [
    {"name": "B", "incoming": "A-B", "outgoing": "B-C"},
    {"name": "C", "incoming": "B-C", "outgoing": "C-D"},
    {"name": "D", "incoming": "C-D", "outgoing": "D-E"},
]
FPS = 24.0
W, H = 1928, 1072
LAST = 241
PRE = 24
POST = 48


def ff(*args: str) -> None:
    subprocess.check_call(["ffmpeg", "-y", "-hide_banner", "-loglevel", "error", *args])


def probe_frames(path: Path) -> int:
    out = subprocess.check_output(
        ["ffprobe", "-v", "error", "-select_streams", "v:0", "-count_frames", "-show_entries", "stream=nb_read_frames", "-of", "csv=p=0", str(path)],
        text=True,
    ).strip()
    return int(out)


def decode_count(path: Path) -> int:
    cap = cv2.VideoCapture(str(path))
    n = 0
    while True:
        ok, _ = cap.read()
        if not ok:
            break
        n += 1
    cap.release()
    return n


def load(path: Path) -> np.ndarray:
    return np.asarray(Image.open(path).convert("RGB"), dtype=np.uint8)


def save(arr: np.ndarray, path: Path) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    Image.fromarray(arr).save(path)


def extract_frame(video: Path, index: int, dest: Path) -> None:
    dest.parent.mkdir(parents=True, exist_ok=True)
    ff("-i", str(video), "-vf", rf"select=eq(n\,{index})", "-vframes", "1", "-q:v", "2", str(dest))


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
            den = (mu_a**2 + mu_b**2 + c1) * (pa.var() + pb.var() + c2)
            acc.append(((2 * mu_a * mu_b + c1) * (2 * ((pa - mu_a) * (pb - mu_b)).mean() + c2)) / den)
    return float(np.mean(acc)) if acc else 0.0


def compare(a: np.ndarray, b: np.ndarray) -> dict:
    a, b = a[:H, :W], b[:H, :W]
    diff = np.abs(a.astype(np.int16) - b.astype(np.int16))
    mse = float((diff.astype(np.float64) ** 2).mean())
    scores = []
    for c in range(3):
        ha = np.histogram(a[:, :, c], bins=256, range=(0, 256))[0].astype(np.float64)
        hb = np.histogram(b[:, :, c], bins=256, range=(0, 256))[0].astype(np.float64)
        ha -= ha.mean()
        hb -= hb.mean()
        den = math.sqrt(float((ha * ha).sum() * (hb * hb).sum()))
        scores.append(0.0 if den == 0 else float((ha * hb).sum() / den))
    return {
        "mae": float(diff.mean()),
        "psnr_db": float(10 * math.log10((255.0**2) / mse) if mse else 99.0),
        "ssim": float(sum(ssim_plane(a[:, :, c], b[:, :, c]) for c in range(3)) / 3.0),
        "histogram_correlation": float(sum(scores) / 3.0),
    }


def decode_range(video: Path, start: int, count: int) -> list[np.ndarray]:
    cap = cv2.VideoCapture(str(video))
    cap.set(cv2.CAP_PROP_POS_FRAMES, start)
    out = []
    for _ in range(count):
        ok, fr = cap.read()
        if not ok:
            break
        out.append(cv2.cvtColor(fr, cv2.COLOR_BGR2RGB))
    cap.release()
    return out


def label_bar(text: str, width: int) -> np.ndarray:
    bar = Image.new("RGB", (width, 40), (18, 18, 18))
    draw = ImageDraw.Draw(bar)
    try:
        font = ImageFont.truetype("/System/Library/Fonts/Helvetica.ttc", 20)
    except OSError:
        font = ImageFont.load_default()
    draw.text((16, 8), text, fill=(240, 240, 240), font=font)
    return np.asarray(bar)


def stack_label(img: np.ndarray, text: str) -> np.ndarray:
    return np.vstack([label_bar(text, img.shape[1]), img])


def write_clip(frames: list[np.ndarray], path: Path) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    tmp = path.with_suffix(".tmp.mp4")
    h, w = frames[0].shape[:2]
    vw = cv2.VideoWriter(str(tmp), cv2.VideoWriter_fourcc(*"mp4v"), FPS, (w, h))
    for fr in frames:
        vw.write(cv2.cvtColor(fr, cv2.COLOR_RGB2BGR))
    vw.release()
    ff("-i", str(tmp), "-c:v", "libx264", "-crf", "18", "-preset", "veryfast", "-pix_fmt", "yuv420p", "-an", str(path))
    tmp.unlink(missing_ok=True)


def encode_leg(src: Path, dest: Path, start: int) -> int:
    dest.parent.mkdir(parents=True, exist_ok=True)
    vf = f"select='gte(n\\,{start})',setpts=N/{FPS}/TB,scale={W}:{H}:flags=bicubic,setsar=1"
    ff("-i", str(src), "-vf", vf, "-r", str(int(FPS)), "-vsync", "cfr", "-c:v", "libx264", "-crf", "18", "-preset", "veryfast", "-pix_fmt", "yuv420p", "-an", str(dest))
    return decode_count(dest)


def concat(paths: list[Path], dest: Path) -> int:
    lst = dest.with_suffix(".txt")
    lst.write_text("".join(f"file '{p}'\n" for p in paths))
    ff("-f", "concat", "-safe", "0", "-i", str(lst), "-c:v", "libx264", "-crf", "18", "-preset", "veryfast", "-pix_fmt", "yuv420p", "-an", str(dest))
    return decode_count(dest)


def main() -> None:
    for d in (FRAMES, DIAG, CLIPS, LEGS):
        d.mkdir(parents=True, exist_ok=True)

    counts = {}
    full_legs = {}
    drop_legs = {}
    for name, src in TAKES.items():
        full = LEGS / f"{name}-full.mp4"
        counts[f"{name}_src"] = probe_frames(src)
        counts[f"{name}_full"] = encode_leg(src, full, 0)
        full_legs[name] = full
        if name != "A-B":
            drop = LEGS / f"{name}-from1.mp4"
            counts[f"{name}_from1"] = encode_leg(src, drop, 1)
            drop_legs[name] = drop

    control_n = concat([full_legs["A-B"], full_legs["B-C"], full_legs["C-D"], full_legs["D-E"]], GEN / "original-control.mp4")
    drop_n = concat([full_legs["A-B"], drop_legs["B-C"], drop_legs["C-D"], drop_legs["D-E"]], GEN / "drop-frame-zero.mp4")
    counts["control_total"] = control_n
    counts["drop_total"] = drop_n
    counts["expected_control"] = 242 * 4
    counts["expected_drop"] = 242 + 241 * 3

    seams = {}
    for seam in SEAMS:
        inc = TAKES[seam["incoming"]]
        out = TAKES[seam["outgoing"]]
        last_p = FRAMES / f"{seam['name']}-incoming-last.png"
        o0_p = FRAMES / f"{seam['name']}-out0.png"
        o1_p = FRAMES / f"{seam['name']}-out1.png"
        o2_p = FRAMES / f"{seam['name']}-out2.png"
        extract_frame(inc, LAST, last_p)
        extract_frame(out, 0, o0_p)
        extract_frame(out, 1, o1_p)
        extract_frame(out, 2, o2_p)
        last, o0, o1, o2 = load(last_p), load(o0_p), load(o1_p), load(o2_p)
        seams[seam["name"]] = {
            "incoming_last_to_out0": compare(last, o0),
            "incoming_last_to_out1": compare(last, o1),
            "out0_to_out1": compare(o0, o1),
            "out1_to_out2": compare(o1, o2),
        }
        save(np.hstack([last, o0, o1]), DIAG / f"{seam['name']}-last-out0-out1.png")

        incoming = decode_range(inc, LAST - PRE + 1, PRE)
        ctrl_post = decode_range(out, 0, POST)
        exp_post = decode_range(out, 1, POST)
        control = incoming + ctrl_post
        experiment = incoming + exp_post
        pair = []
        for a, b in zip(control, experiment):
            pair.append(np.hstack([
                stack_label(a, f"CONTROL {seam['name']}  last | out0"),
                stack_label(b, f"DROP-0 {seam['name']}  last | out1"),
            ]))
        write_clip(pair, CLIPS / f"compare-{seam['name']}-original-vs-drop0.mp4")

    # Sequential full-length comparison (normal speed).
    seq_list = GEN / "control-vs-drop0.txt"
    seq_list.write_text(
        f"file '{GEN / 'original-control.mp4'}'\nfile '{GEN / 'drop-frame-zero.mp4'}'\n"
    )
    ff("-f", "concat", "-safe", "0", "-i", str(seq_list), "-c:v", "libx264", "-crf", "18", "-preset", "veryfast", "-pix_fmt", "yuv420p", "-an", str(GEN / "control-vs-drop0.mp4"))

    report = {
        "experiment": "drop-outgoing-frame-zero",
        "kling_generations": 0,
        "camotion_generations": 0,
        "production_code_changed": False,
        "incoming_untouched": True,
        "sources": {k: str(v) for k, v in TAKES.items()},
        "frame_counts": counts,
        "dropped_exactly_one_per_subsequent": all(counts[f"{n}_from1"] == counts[f"{n}_src"] - 1 for n in ("B-C", "C-D", "D-E")),
        "seams": seams,
        "control_cut": "incoming-last | outgoing-0",
        "experiment_cut": "incoming-last | outgoing-1",
    }
    (GEN / "metrics.json").write_text(json.dumps(report, indent=2) + "\n")
    print(json.dumps({
        "counts": counts,
        "dropped_ok": report["dropped_exactly_one_per_subsequent"],
        "seams": {
            k: {
                "last_to_0_ssim": v["incoming_last_to_out0"]["ssim"],
                "last_to_0_mae": v["incoming_last_to_out0"]["mae"],
                "last_to_1_ssim": v["incoming_last_to_out1"]["ssim"],
                "last_to_1_mae": v["incoming_last_to_out1"]["mae"],
                "out0_to_1_mae": v["out0_to_out1"]["mae"],
            }
            for k, v in seams.items()
        },
    }, indent=2))


if __name__ == "__main__":
    main()
