#!/usr/bin/env python3
"""Read-only drop-0 validation across a capped project sample. Experiment-local."""

from __future__ import annotations

import csv
import json
import math
import subprocess
from pathlib import Path

import cv2
import numpy as np
from PIL import Image, ImageDraw, ImageFont

REPO = Path(__file__).resolve().parents[3]
EXP = Path(__file__).resolve().parent
PROJ = REPO / "projects"
CLIPS = EXP / "clips"
DIAG = EXP / "diagnostics"
FPS = 24.0

SELECTED = json.loads((EXP / "selected-projects.json").read_text())["selected"]


def ff(*args: str) -> None:
    subprocess.check_call(["ffmpeg", "-y", "-hide_banner", "-loglevel", "error", *args])


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
    h = min(a.shape[0], b.shape[0])
    w = min(a.shape[1], b.shape[1])
    a, b = a[:h, :w], b[:h, :w]
    if a.shape != b.shape:
        b = cv2.resize(b, (a.shape[1], a.shape[0]), interpolation=cv2.INTER_AREA)
        a, b = a, b
        h, w = a.shape[:2]
    diff = np.abs(a.astype(np.int16) - b.astype(np.int16))
    mse = float((diff.astype(np.float64) ** 2).mean())
    return {
        "mae": float(diff.mean()),
        "psnr_db": float(10 * math.log10((255.0**2) / mse) if mse else 99.0),
        "ssim": float(sum(ssim_plane(a[:, :, c], b[:, :, c]) for c in range(3)) / 3.0),
    }


def decode_index(path: Path, index: int) -> np.ndarray | None:
    cap = cv2.VideoCapture(str(path))
    n = int(cap.get(cv2.CAP_PROP_FRAME_COUNT) or 0)
    if index < 0:
        index = n + index
    cap.set(cv2.CAP_PROP_POS_FRAMES, index)
    ok, fr = cap.read()
    cap.release()
    if not ok:
        return None
    return cv2.cvtColor(fr, cv2.COLOR_BGR2RGB)


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


def selected_take_path(project_dir: Path, traversal: dict, tjson: dict) -> Path | None:
    folder = project_dir / Path(traversal["file"]).parent
    sid = tjson.get("selectedTakeId")
    for tk in tjson.get("takes") or []:
        if sid and tk.get("id") == sid:
            asset = tk.get("asset") or "take-01.mp4"
            p = folder / asset
            if p.exists():
                return p
    p = folder / "take-01.mp4"
    return p if p.exists() else None


def take_meta(tjson: dict) -> dict:
    sid = tjson.get("selectedTakeId")
    for tk in tjson.get("takes") or []:
        if sid and tk.get("id") == sid:
            vi = tk.get("videoInputs") or {}
            return {
                "model": tk.get("model"),
                "provider": tk.get("provider"),
                "intent": tk.get("generationIntent"),
                "durationSeconds": tk.get("durationSeconds"),
                "startShootingFrame": bool(vi.get("startShootingFrame")),
                "endShootingFrame": bool(vi.get("endShootingFrame")),
                "asset": tk.get("asset"),
            }
    return {}


def load_project(dirname: str) -> dict:
    d = PROJ / dirname
    pj = json.loads((d / "project.json").read_text())
    settings = pj.get("settings") or {}
    legs = []
    for t in pj.get("traversals") or []:
        tf = d / t["file"]
        tj = json.loads(tf.read_text()) if tf.exists() else {}
        path = selected_take_path(d, t, tj)
        if path is None:
            continue
        meta = take_meta(tj)
        legs.append({
            "id": t["id"],
            "from": t.get("from") or tj.get("startDestinationId"),
            "to": t.get("to") or tj.get("endDestinationId"),
            "path": path,
            "nframes": None,
            **meta,
        })
    return {
        "dir": dirname,
        "name": pj.get("name") or dirname,
        "grammar": settings.get("cameraGrammar") or "unspecified",
        "created": (pj.get("createdAt") or "")[:10],
        "legs": legs,
    }


def measure_seam(proj: dict, incoming: dict, outgoing: dict, role: str) -> dict:
    inc_n = decode_count(incoming["path"])
    out_n = decode_count(outgoing["path"])
    L = decode_index(incoming["path"], inc_n - 1)
    O0 = decode_index(outgoing["path"], 0)
    O1 = decode_index(outgoing["path"], 1)
    O2 = decode_index(outgoing["path"], 2)
    if any(x is None for x in (L, O0, O1, O2)):
        raise RuntimeError(f"decode failed {proj['dir']} {incoming['id']}|{outgoing['id']}")
    L0 = compare(L, O0)
    L1 = compare(L, O1)
    O01 = compare(O0, O1)
    O12 = compare(O1, O2)
    motion_o01 = O01["mae"]
    motion_l1 = L1["mae"]
    ratio = motion_l1 / motion_o01 if motion_o01 > 1e-6 else None
    return {
        "project": proj["dir"],
        "role": role,
        "grammar": proj["grammar"],
        "created": proj["created"],
        "seam": f"{incoming['id']}|{outgoing['id']}",
        "incoming_id": incoming["id"],
        "outgoing_id": outgoing["id"],
        "incoming_path": str(incoming["path"].relative_to(REPO)),
        "outgoing_path": str(outgoing["path"].relative_to(REPO)),
        "incoming_model": incoming.get("model"),
        "outgoing_model": outgoing.get("model"),
        "incoming_frames": inc_n,
        "outgoing_frames": out_n,
        "camotion_start": outgoing.get("startShootingFrame"),
        "camotion_end": incoming.get("endShootingFrame"),
        "L_O0_ssim": L0["ssim"],
        "L_O0_mae": L0["mae"],
        "L_O0_psnr": L0["psnr_db"],
        "L_O1_ssim": L1["ssim"],
        "L_O1_mae": L1["mae"],
        "L_O1_psnr": L1["psnr_db"],
        "O0_O1_ssim": O01["ssim"],
        "O0_O1_mae": O01["mae"],
        "O0_O1_psnr": O01["psnr_db"],
        "O1_O2_ssim": O12["ssim"],
        "O1_O2_mae": O12["mae"],
        "O1_O2_psnr": O12["psnr_db"],
        "motion_ratio": ratio,
    }


def pct(values: list[float], p: float) -> float:
    if not values:
        return float("nan")
    s = sorted(values)
    i = min(len(s) - 1, max(0, int(round((p / 100.0) * (len(s) - 1)))))
    return s[i]


def summarize(rows: list[dict]) -> dict:
    def col(key: str) -> list[float]:
        return [float(r[key]) for r in rows if r.get(key) is not None]

    keys = ["L_O0_ssim", "L_O0_mae", "L_O1_ssim", "L_O1_mae", "O0_O1_mae", "L_O1_mae", "motion_ratio"]
    out = {"n": len(rows)}
    for k in ["L_O0_ssim", "L_O0_mae", "L_O1_ssim", "L_O1_mae", "O0_O1_mae", "motion_ratio"]:
        v = col(k)
        out[k] = {
            "n": len(v),
            "median": float(np.median(v)) if v else None,
            "p10": pct(v, 10),
            "p90": pct(v, 90),
            "min": min(v) if v else None,
            "max": max(v) if v else None,
        }
    return out


def decode_range(path: Path, start: int, count: int) -> list[np.ndarray]:
    cap = cv2.VideoCapture(str(path))
    if start < 0:
        n = int(cap.get(cv2.CAP_PROP_FRAME_COUNT) or 0)
        start = max(0, n + start)
    cap.set(cv2.CAP_PROP_POS_FRAMES, start)
    out = []
    for _ in range(count):
        ok, fr = cap.read()
        if not ok:
            break
        out.append(cv2.cvtColor(fr, cv2.COLOR_BGR2RGB))
    cap.release()
    return out


def stack_label(img: np.ndarray, text: str) -> np.ndarray:
    bar = Image.new("RGB", (img.shape[1], 36), (18, 18, 18))
    draw = ImageDraw.Draw(bar)
    try:
        font = ImageFont.truetype("/System/Library/Fonts/Helvetica.ttc", 18)
    except OSError:
        font = ImageFont.load_default()
    draw.text((12, 8), text, fill=(240, 240, 240), font=font)
    return np.vstack([np.asarray(bar), img])


def write_clip(frames: list[np.ndarray], path: Path) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    tmp = path.with_suffix(".tmp.mp4")
    h, w = frames[0].shape[:2]
    vw = cv2.VideoWriter(str(tmp), cv2.VideoWriter_fourcc(*"mp4v"), FPS, (w, h))
    for fr in frames:
        if fr.shape[0] != h or fr.shape[1] != w:
            fr = cv2.resize(fr, (w, h))
        vw.write(cv2.cvtColor(fr, cv2.COLOR_RGB2BGR))
    vw.release()
    ff("-i", str(tmp), "-c:v", "libx264", "-crf", "20", "-preset", "veryfast", "-pix_fmt", "yuv420p", "-an", str(path))
    tmp.unlink(missing_ok=True)


def render_compare(row: dict, dest: Path) -> None:
    inc = REPO / row["incoming_path"]
    out = REPO / row["outgoing_path"]
    incoming = decode_range(inc, -24, 24)
    ctrl = incoming + decode_range(out, 0, 36)
    exp = incoming + decode_range(out, 1, 36)
    pair = []
    for a, b in zip(ctrl, exp):
        if a.shape != b.shape:
            b = cv2.resize(b, (a.shape[1], a.shape[0]))
        pair.append(np.hstack([
            stack_label(a, f"CONTROL {row['project']} {row['seam']}  L|O0"),
            stack_label(b, f"DROP-0 {row['project']} {row['seam']}  L|O1"),
        ]))
    write_clip(pair, dest)


def main() -> None:
    CLIPS.mkdir(parents=True, exist_ok=True)
    DIAG.mkdir(parents=True, exist_ok=True)
    rows = []
    for spec in SELECTED:
        proj = load_project(spec["dir"])
        legs = proj["legs"]
        for i in range(len(legs) - 1):
            a, b = legs[i], legs[i + 1]
            if a["to"] != b["from"]:
                continue
            row = measure_seam(proj, a, b, spec["role"])
            rows.append(row)
            print(f"{row['role'][:7]:7} {row['project'][:22]:22} {row['seam']:12} L-O0 {row['L_O0_ssim']:.3f}/{row['L_O0_mae']:.1f}  L-O1 {row['L_O1_mae']:.1f}  O01 {row['O0_O1_mae']:.1f}  r={row['motion_ratio']:.2f}")

    fields = list(rows[0].keys())
    with (EXP / "seams.csv").open("w", newline="") as f:
        w = csv.DictWriter(f, fieldnames=fields)
        w.writeheader()
        w.writerows(rows)

    control = [r for r in rows if r["role"] == "known_control"]
    validation = [r for r in rows if r["role"] == "validation"]
    stats = {
        "control_TheLongWayDown": summarize(control),
        "validation_new": summarize(validation),
        "by_grammar": {},
        "by_model": {},
    }
    grammars = sorted({r["grammar"] for r in validation})
    for g in grammars:
        stats["by_grammar"][g] = summarize([r for r in validation if r["grammar"] == g])
    models = sorted({(r["outgoing_model"] or "unknown") for r in validation})
    for m in models:
        stats["by_model"][m] = summarize([r for r in validation if (r["outgoing_model"] or "unknown") == m])
    (EXP / "aggregate.json").write_text(json.dumps(stats, indent=2) + "\n")
    print(json.dumps({"n_control": len(control), "n_validation": len(validation), "val_median": stats["validation_new"]}, indent=2))


if __name__ == "__main__":
    main()
