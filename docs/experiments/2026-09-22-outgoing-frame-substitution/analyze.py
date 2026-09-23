#!/usr/bin/env python3
"""One-frame outgoing substitution at the C seam. Experiment-local."""

from __future__ import annotations

import hashlib
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
BC = REPO / "projects/TheLongWayDown/traversals/B-C/take-01.mp4"
CD = REPO / "projects/TheLongWayDown/traversals/C-D/take-01.mp4"
EXISTING_CS = REPO / "docs/experiments/2026-09-22-smart-prelock-trim/TheLongWayDown/generated/C-D/first.png"
EXISTING_LOCK = REPO / "docs/experiments/2026-09-22-smart-prelock-trim/TheLongWayDown/generated/B-C/Ce_literal.png"

FPS = 24.0
W, H = 1928, 1072
LOCK = 241
PRE = 24
POST = 48


def ff(*args: str) -> None:
    subprocess.check_call(["ffmpeg", "-y", "-hide_banner", "-loglevel", "error", *args])


def sha256(path: Path) -> str:
    h = hashlib.sha256()
    with path.open("rb") as f:
        for chunk in iter(lambda: f.read(1 << 20), b""):
            h.update(chunk)
    return h.hexdigest()


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
    ssim = float(sum(ssim_plane(a[:, :, c], b[:, :, c]) for c in range(3)) / 3.0)
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
        "rmse": float(math.sqrt(mse)),
        "psnr_db": float(10 * math.log10((255.0**2) / mse) if mse else 99.0),
        "ssim": ssim,
        "histogram_correlation": float(sum(scores) / 3.0),
        "max_abs": int(diff.max()),
        "pair_mae": float(diff.mean()),
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


def label_bar(text: str, width: int = W) -> np.ndarray:
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


def motion_series(frames: list[np.ndarray]) -> list[float]:
    return [float(np.mean(np.abs(a.astype(np.int16) - b.astype(np.int16)))) for a, b in zip(frames, frames[1:])]


def main() -> None:
    for d in (FRAMES, DIAG, CLIPS):
        d.mkdir(parents=True, exist_ok=True)

    for idx, name in [(239, "F239"), (240, "F240"), (241, "F241_lock")]:
        extract_frame(BC, idx, FRAMES / f"{name}.png")
    extract_frame(CD, 0, FRAMES / "Cs_rendered.png")
    extract_frame(CD, 1, FRAMES / "D1.png")

    f239 = load(FRAMES / "F239.png")
    f240 = load(FRAMES / "F240.png")
    lock = load(FRAMES / "F241_lock.png")
    cs = load(FRAMES / "Cs_rendered.png")
    d1 = load(FRAMES / "D1.png")

    identity = {
        "bc": str(BC),
        "cd": str(CD),
        "lock_matches_existing_literal": compare(lock, load(EXISTING_LOCK)) if EXISTING_LOCK.exists() else None,
        "cs_matches_existing_first": compare(cs, load(EXISTING_CS)) if EXISTING_CS.exists() else None,
        "cs_sha": sha256(FRAMES / "Cs_rendered.png"),
        "lock_sha": sha256(FRAMES / "F241_lock.png"),
        "cs_equals_lock": sha256(FRAMES / "Cs_rendered.png") == sha256(FRAMES / "F241_lock.png"),
    }

    pairs = {
        "F239_to_F240": compare(f239, f240),
        "F240_to_lock": compare(f240, lock),
        "lock_to_Cs": compare(lock, cs),
        "Cs_to_D1": compare(cs, d1),
        "F240_to_Cs": compare(f240, cs),
    }

    incoming_start = LOCK - PRE + 1
    incoming = decode_range(BC, incoming_start, PRE)
    assert len(incoming) == PRE
    assert incoming[-1].shape == lock.shape
    outgoing_from_cs = decode_range(CD, 0, POST)
    outgoing_from_d1 = decode_range(CD, 1, POST)

    control = incoming + outgoing_from_cs
    experiment = incoming[:-1] + [cs] + outgoing_from_d1
    assert len(control) == len(experiment) == PRE + POST
    # Cs once in experiment: last incoming slot, not first outgoing
    exp_incoming_last = experiment[PRE - 1]
    exp_outgoing_first = experiment[PRE]
    assert float(np.mean(np.abs(exp_incoming_last.astype(np.int16) - cs.astype(np.int16)))) == 0.0
    assert float(np.mean(np.abs(exp_outgoing_first.astype(np.int16) - d1.astype(np.int16)))) == 0.0
    cs_count = sum(1 for fr in experiment if np.array_equal(fr, cs))
    # pixel-exact count can fail after decode; use MAE==0
    cs_count = sum(1 for fr in experiment if float(np.mean(np.abs(fr.astype(np.int16) - cs.astype(np.int16)))) < 0.5)

    save(np.hstack([incoming[-1], outgoing_from_cs[0]]), DIAG / "control-touch.png")
    save(np.hstack([experiment[PRE - 1], experiment[PRE]]), DIAG / "experiment-touch.png")
    save(np.hstack([f240, lock, cs]), DIAG / "F240-lock-Cs.png")
    save(np.hstack([f240, cs, d1]), DIAG / "F240-Cs-D1.png")

    control_motion = motion_series(control[PRE - 4 : PRE + 4])
    experiment_motion = motion_series(experiment[PRE - 4 : PRE + 4])

    write_clip([stack_label(fr, "CONTROL  F241(lock) | Cs → D1") for fr in control], CLIPS / "control-C-original.mp4")
    write_clip([stack_label(fr, "EXPERIMENT  F240 → Cs | D1   (Cs once)") for fr in experiment], CLIPS / "experiment-C-replace-last-with-Cs.mp4")
    pair = []
    for a, b in zip(control, experiment):
        pair.append(np.hstack([stack_label(a, "CONTROL"), stack_label(b, "REPLACE LAST WITH Cs")]))
    write_clip(pair, CLIPS / "compare-control-vs-replace.mp4")

    metrics = {
        "experiment": "outgoing-frame-substitution",
        "kling_generations": 0,
        "camotion_generations": 0,
        "production_code_changed": False,
        "replaced_incoming_frame": {"index": LOCK, "name": "F241 lock / Ce_literal"},
        "replacement": {"video": "C-D/take-01.mp4", "index": 0, "name": "Cs_rendered"},
        "outgoing_continues_at": {"index": 1, "name": "D1"},
        "cs_appears_once": cs_count == 1,
        "cs_count_in_experiment_clip": cs_count,
        "clip_frames": {"pre": PRE, "post": POST, "total": PRE + POST},
        "identity": identity,
        "pairs": pairs,
        "motion_pair_mae_around_cut": {
            "labels": ["-3", "-2", "-1", "CUT", "+1", "+2", "+3"],
            "control": control_motion,
            "experiment": experiment_motion,
        },
        "control_cut": "F241(lock) | Cs",
        "experiment_cut": "Cs | D1",
    }
    (GEN / "metrics.json").write_text(json.dumps(metrics, indent=2) + "\n")
    print(json.dumps({
        "cs_once": cs_count == 1,
        "F240_to_lock_ssim": pairs["F240_to_lock"]["ssim"],
        "lock_to_Cs_ssim": pairs["lock_to_Cs"]["ssim"],
        "F240_to_Cs_ssim": pairs["F240_to_Cs"]["ssim"],
        "Cs_to_D1_ssim": pairs["Cs_to_D1"]["ssim"],
        "control_motion": control_motion,
        "experiment_motion": experiment_motion,
    }, indent=2))


if __name__ == "__main__":
    main()
