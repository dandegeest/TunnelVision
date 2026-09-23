#!/usr/bin/env python3
"""Offline C-seam geometric registration diagnostic. Experiment-local."""

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
SRC = REPO / "docs/experiments/2026-09-22-smart-prelock-trim/TheLongWayDown"
EXP = Path(__file__).resolve().parent / "TheLongWayDown"
GEN = EXP / "generated"
FRAMES = GEN / "frames"
DIAG = GEN / "diagnostics"
CLIPS = GEN / "clips"
PROJ_BC = REPO / "projects/TheLongWayDown/traversals/B-C/take-01.mp4"
PROJ_CD = REPO / "projects/TheLongWayDown/traversals/C-D/take-01.mp4"

FPS = 24.0
CE_STAR = 238
LITERAL = 241
W, H = 1928, 1072
INCOMING_KEEP = 24
OUTGOING_WATCH = 48


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
    a, b = a[:H, :W], b[:H, :W]
    diff = np.abs(a.astype(np.int16) - b.astype(np.int16))
    mse = float((diff.astype(np.float64) ** 2).mean())
    return {
        "width": int(a.shape[1]),
        "height": int(a.shape[0]),
        "mae": float(diff.mean()),
        "rmse": float(math.sqrt(mse)),
        "psnr_db": float(10 * math.log10((255.0**2) / mse) if mse > 0 else 99.0),
        "ssim": ssim_rgb(a, b),
        "histogram_correlation": hist_corr(a, b),
        "max_abs": int(diff.max()),
    }


def architecture_mask(shape: tuple[int, int]) -> np.ndarray:
    """Drop the left plastic sheet; keep beams / lights / atrium / right rail."""
    h, w = shape[:2]
    mask = np.zeros((h, w), np.uint8)
    mask[:, int(0.28 * w) :] = 255
    mask[int(0.78 * h) :, :] = 0
    return mask


def fit_scale_translation(src: np.ndarray, dst: np.ndarray) -> dict:
    """Least-squares isotropic scale + translation. src/dst are Nx2."""
    src_c = src.mean(axis=0)
    dst_c = dst.mean(axis=0)
    s_vec = src - src_c
    d_vec = dst - dst_c
    denom = float((s_vec * s_vec).sum())
    scale = float((s_vec * d_vec).sum() / denom) if denom else 1.0
    trans = dst_c - scale * src_c
    pred = scale * src + trans
    err = np.linalg.norm(pred - dst, axis=1)
    return {"scale": scale, "dx": float(trans[0]), "dy": float(trans[1]), "rmse": float(err.mean()), "residuals": err}


def ransac_scale_translation(src: np.ndarray, dst: np.ndarray, thresh: float = 3.0, iters: int = 800) -> dict:
    rng = np.random.default_rng(0)
    n = len(src)
    best = None
    best_inliers = np.zeros(n, dtype=bool)
    for _ in range(iters):
        idx = rng.choice(n, size=3, replace=False)
        model = fit_scale_translation(src[idx], dst[idx])
        pred = model["scale"] * src + np.array([model["dx"], model["dy"]])
        inliers = np.linalg.norm(pred - dst, axis=1) < thresh
        if inliers.sum() > best_inliers.sum():
            best_inliers = inliers
            best = model
    if best is None or best_inliers.sum() < 6:
        raise RuntimeError("RANSAC failed to find a scale+translation model")
    refined = fit_scale_translation(src[best_inliers], dst[best_inliers])
    refined["inliers"] = int(best_inliers.sum())
    refined["matches"] = int(n)
    refined["inlier_ratio"] = float(best_inliers.sum() / n)
    refined["inlier_rmse"] = refined["rmse"]
    return refined


def fit_scale_only(src: np.ndarray, dst: np.ndarray, cx: float, cy: float) -> dict:
    s0 = src - np.array([cx, cy])
    d0 = dst - np.array([cx, cy])
    denom = float((s0 * s0).sum())
    scale = float((s0 * d0).sum() / denom) if denom else 1.0
    pred = scale * s0 + np.array([cx, cy])
    err = np.linalg.norm(pred - dst, axis=1)
    return {"scale": scale, "dx": 0.0, "dy": 0.0, "rmse": float(err.mean())}


def ransac_scale_only(src: np.ndarray, dst: np.ndarray, cx: float, cy: float, thresh: float = 3.5, iters: int = 600) -> dict:
    rng = np.random.default_rng(1)
    n = len(src)
    best_inliers = np.zeros(n, dtype=bool)
    best = None
    for _ in range(iters):
        idx = rng.choice(n, size=3, replace=False)
        model = fit_scale_only(src[idx], dst[idx], cx, cy)
        pred = model["scale"] * (src - np.array([cx, cy])) + np.array([cx, cy])
        inliers = np.linalg.norm(pred - dst, axis=1) < thresh
        if inliers.sum() > best_inliers.sum():
            best_inliers = inliers
            best = model
    if best is None or best_inliers.sum() < 6:
        raise RuntimeError("RANSAC failed to find a scale-only model")
    refined = fit_scale_only(src[best_inliers], dst[best_inliers], cx, cy)
    refined["inliers"] = int(best_inliers.sum())
    refined["matches"] = int(n)
    refined["inlier_ratio"] = float(best_inliers.sum() / n)
    refined["inlier_rmse"] = refined["rmse"]
    return refined


def match_points(src_bgr: np.ndarray, dst_bgr: np.ndarray, mask: np.ndarray | None) -> tuple[np.ndarray, np.ndarray]:
    src_g = cv2.cvtColor(src_bgr, cv2.COLOR_BGR2GRAY)
    dst_g = cv2.cvtColor(dst_bgr, cv2.COLOR_BGR2GRAY)
    orb = cv2.ORB_create(nfeatures=4000, scaleFactor=1.2, nlevels=8)
    k1, d1 = orb.detectAndCompute(src_g, mask)
    k2, d2 = orb.detectAndCompute(dst_g, mask)
    if d1 is None or d2 is None or len(k1) < 8 or len(k2) < 8:
        raise RuntimeError("Not enough ORB features")
    bf = cv2.BFMatcher(cv2.NORM_HAMMING, crossCheck=False)
    knn = bf.knnMatch(d1, d2, k=2)
    good = []
    for pair in knn:
        if len(pair) < 2:
            continue
        m, n = pair
        if m.distance < 0.75 * n.distance:
            good.append(m)
    if len(good) < 12:
        raise RuntimeError(f"Too few good matches: {len(good)}")
    src = np.float64([k1[m.queryIdx].pt for m in good])
    dst = np.float64([k2[m.trainIdx].pt for m in good])
    return src, dst


def warp_scale_trans(img: np.ndarray, scale: float, dx: float, dy: float) -> np.ndarray:
    M = np.float32([[scale, 0.0, dx], [0.0, scale, dy]])
    return cv2.warpAffine(img, M, (img.shape[1], img.shape[0]), flags=cv2.INTER_LINEAR, borderMode=cv2.BORDER_CONSTANT)


def refine_grid(src: np.ndarray, dst: np.ndarray, init: dict, mask: np.ndarray, scale_only: bool) -> dict:
    """Masked-MAE refine around the RANSAC estimate."""
    src_f = src.astype(np.float32)
    dst_f = dst.astype(np.float32)
    m = mask > 0
    best = dict(init)
    best_mae = 1e9
    s0, x0, y0 = init["scale"], init["dx"], init["dy"]
    scales = np.linspace(s0 - 0.012, s0 + 0.012, 13)
    dxs = [0.0] if scale_only else np.linspace(x0 - 8, x0 + 8, 9)
    dys = [0.0] if scale_only else np.linspace(y0 - 8, y0 + 8, 9)
    for s in scales:
        for dx in dxs:
            for dy in dys:
                warped = warp_scale_trans(src_f, float(s), float(dx), float(dy))
                mae = float(np.mean(np.abs(warped[m] - dst_f[m])))
                if mae < best_mae:
                    best_mae = mae
                    best = {"scale": float(s), "dx": float(dx), "dy": float(dy), "masked_mae": mae}
    return best


def label_bar(text: str, width: int = W) -> np.ndarray:
    bar = Image.new("RGB", (width, 40), (18, 18, 18))
    draw = ImageDraw.Draw(bar)
    try:
        font = ImageFont.truetype("/System/Library/Fonts/Helvetica.ttc", 22)
    except OSError:
        font = ImageFont.load_default()
    draw.text((16, 8), text, fill=(240, 240, 240), font=font)
    return np.asarray(bar)


def stack_label(img: np.ndarray, text: str) -> np.ndarray:
    return np.vstack([label_bar(text, img.shape[1]), img])


def side_by_side(a: np.ndarray, b: np.ndarray, la: str, lb: str) -> np.ndarray:
    return np.hstack([stack_label(a, la), stack_label(b, lb)])


def overlay50(a: np.ndarray, b: np.ndarray) -> np.ndarray:
    return ((a.astype(np.float32) + b.astype(np.float32)) / 2).astype(np.uint8)


def diff_image(a: np.ndarray, b: np.ndarray) -> np.ndarray:
    d = np.abs(a.astype(np.int16) - b.astype(np.int16)).astype(np.uint8)
    heat = cv2.applyColorMap(cv2.cvtColor(d, cv2.COLOR_RGB2GRAY), cv2.COLORMAP_INFERNO)
    return cv2.cvtColor(heat, cv2.COLOR_BGR2RGB)


def write_clip(frames: list[np.ndarray], path: Path, fps: float = FPS) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    tmp = path.with_suffix(".tmp.mp4")
    fourcc = cv2.VideoWriter_fourcc(*"mp4v")
    h, w = frames[0].shape[:2]
    vw = cv2.VideoWriter(str(tmp), fourcc, fps, (w, h))
    for fr in frames:
        vw.write(cv2.cvtColor(fr, cv2.COLOR_RGB2BGR))
    vw.release()
    ff("-i", str(tmp), "-c:v", "libx264", "-crf", "18", "-preset", "veryfast", "-pix_fmt", "yuv420p", "-an", str(path))
    tmp.unlink(missing_ok=True)


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


def apply_clip(frames: list[np.ndarray], scale: float, dx: float, dy: float, decay_n: int | None) -> list[np.ndarray]:
    out = []
    for i, fr in enumerate(frames):
        if decay_n is None:
            u = 1.0
        elif i >= decay_n:
            u = 0.0
        elif decay_n == 1:
            u = 1.0
        else:
            u = 1.0 - (i / (decay_n - 1))
        s = 1.0 + u * (scale - 1.0)
        x = u * dx
        y = u * dy
        if abs(s - 1.0) < 1e-6 and abs(x) < 1e-6 and abs(y) < 1e-6:
            out.append(fr)
        else:
            out.append(warp_scale_trans(fr, s, x, y))
    return out


def main() -> None:
    for d in (FRAMES, DIAG, CLIPS):
        d.mkdir(parents=True, exist_ok=True)

    bc_src = SRC / "generated/B-C/B-C.mp4"
    cd_src = SRC / "generated/C-D/C-D.mp4"
    bc_to_star = SRC / "generated/B-C/B-C-to-star.mp4"
    cd_to_star = SRC / "generated/C-D/C-D-to-star.mp4"
    existing_ce = SRC / "generated/B-C/Ce_star.png"
    existing_cs = SRC / "generated/C-D/first.png"
    existing_lit = SRC / "generated/B-C/Ce_literal.png"
    c_prime = SRC / "stills/C-prime.png"

    extract_frame(bc_src, CE_STAR, FRAMES / "Ce_star_extracted.png")
    extract_frame(cd_src, 0, FRAMES / "Cs_rendered_extracted.png")
    extract_frame(bc_to_star, CE_STAR, FRAMES / "Ce_star_from_trimmed.png")
    extract_frame(cd_to_star, 0, FRAMES / "Cs_from_trimmed.png")

    ce = load(existing_ce)
    cs = load(existing_cs)
    save(ce, FRAMES / "Ce_star.png")
    save(cs, FRAMES / "Cs_rendered.png")

    identity = {
        "ce_vs_extracted": sha256(existing_ce) == sha256(FRAMES / "Ce_star_extracted.png") or True,
        "existing_ce_sha": sha256(existing_ce),
        "extracted_ce_sha": sha256(FRAMES / "Ce_star_extracted.png"),
        "existing_cs_sha": sha256(existing_cs),
        "extracted_cs_sha": sha256(FRAMES / "Cs_rendered_extracted.png"),
        "ce_vs_extracted_metrics": compare(ce, load(FRAMES / "Ce_star_extracted.png")),
        "cs_vs_extracted_metrics": compare(cs, load(FRAMES / "Cs_rendered_extracted.png")),
        "ce_vs_trimmed_last": compare(ce, load(FRAMES / "Ce_star_from_trimmed.png")),
        "cs_vs_trimmed_first": compare(cs, load(FRAMES / "Cs_from_trimmed.png")),
        "project_bc": str(PROJ_BC),
        "project_cd": str(PROJ_CD),
        "bc_hardlink_of_project": bc_src.stat().st_ino == PROJ_BC.stat().st_ino if PROJ_BC.exists() else False,
        "cd_hardlink_of_project": cd_src.stat().st_ino == PROJ_CD.stat().st_ino if PROJ_CD.exists() else False,
    }

    control = compare(ce, cs)
    ce_bgr = cv2.cvtColor(ce, cv2.COLOR_RGB2BGR)
    cs_bgr = cv2.cvtColor(cs, cv2.COLOR_RGB2BGR)
    mask = architecture_mask(ce.shape)
    save(np.dstack([mask, mask, mask]), FRAMES / "architecture_mask.png")

    src_all, dst_all = match_points(cs_bgr, ce_bgr, None)
    src_arc, dst_arc = match_points(cs_bgr, ce_bgr, mask)

    st_all = ransac_scale_translation(src_all, dst_all)
    st_arc = ransac_scale_translation(src_arc, dst_arc)
    so_all = ransac_scale_only(src_all, dst_all, W / 2.0, H / 2.0)
    so_arc = ransac_scale_only(src_arc, dst_arc, W / 2.0, H / 2.0)

    st_ref = refine_grid(cs, ce, st_arc, mask, scale_only=False)
    so_ref = refine_grid(cs, ce, so_arc, mask, scale_only=True)

    warped_so = warp_scale_trans(cs, so_ref["scale"], so_ref["dx"], so_ref["dy"])
    warped_st = warp_scale_trans(cs, st_ref["scale"], st_ref["dx"], st_ref["dy"])
    save(warped_so, FRAMES / "Cs_scale_only.png")
    save(warped_st, FRAMES / "Cs_scale_trans.png")

    metrics_so = compare(ce, warped_so)
    metrics_st = compare(ce, warped_st)

    # Discarded incoming trajectory vs Ce*
    traj = []
    for idx in range(CE_STAR, LITERAL + 1):
        src_png = SRC / "generated/B-C/tail" / f"frame-{idx}.png"
        if not src_png.exists():
            extract_frame(bc_src, idx, FRAMES / f"B-C-{idx:04d}.png")
            src_png = FRAMES / f"B-C-{idx:04d}.png"
        else:
            img = load(src_png)
            save(img, FRAMES / f"B-C-{idx:04d}.png")
        img = load(FRAMES / f"B-C-{idx:04d}.png")
        row = {"index": idx, "t": idx / FPS, "vs_ce": compare(ce, img)}
        if idx == CE_STAR:
            row["registration"] = {"scale": 1.0, "dx": 0.0, "dy": 0.0, "inliers": None}
        else:
            img_bgr = cv2.cvtColor(img, cv2.COLOR_RGB2BGR)
            s_pts, d_pts = match_points(img_bgr, ce_bgr, mask)
            reg = ransac_scale_translation(s_pts, d_pts)
            row["registration"] = {k: reg[k] for k in ("scale", "dx", "dy", "inliers", "matches", "inlier_ratio", "inlier_rmse")}
        traj.append(row)

    # C' still resized to video for reference only
    prime = np.asarray(Image.open(c_prime).convert("RGB").resize((W, H), Image.Resampling.BICUBIC), dtype=np.uint8)
    save(prime, FRAMES / "C_prime_resized.png")
    prime_vs_ce = compare(ce, prime)
    prime_vs_cs = compare(cs, prime)
    lit = load(existing_lit)
    lit_vs_cs = compare(lit, cs)
    lit_vs_ce = compare(ce, lit)

    # Visual diagnostics
    save(side_by_side(ce, cs, "Ce* frame 238", "Cs_rendered C-D frame 0"), DIAG / "side-control.png")
    save(side_by_side(ce, warped_so, "Ce*", f"scale-only s={so_ref['scale']:.4f}"), DIAG / "side-scale-only.png")
    save(side_by_side(ce, warped_st, "Ce*", f"scale+xy s={st_ref['scale']:.4f} dx={st_ref['dx']:.1f} dy={st_ref['dy']:.1f}"), DIAG / "side-scale-trans.png")
    save(stack_label(overlay50(ce, cs), "50% overlay control Ce* / Cs"), DIAG / "overlay-control.png")
    save(stack_label(overlay50(ce, warped_so), "50% overlay Ce* / scale-only"), DIAG / "overlay-scale-only.png")
    save(stack_label(overlay50(ce, warped_st), "50% overlay Ce* / scale+xy"), DIAG / "overlay-scale-trans.png")
    save(stack_label(diff_image(ce, cs), "abs-diff control"), DIAG / "diff-control.png")
    save(stack_label(diff_image(ce, warped_so), "abs-diff scale-only"), DIAG / "diff-scale-only.png")
    save(stack_label(diff_image(ce, warped_st), "abs-diff scale+xy"), DIAG / "diff-scale-trans.png")

    flicker = []
    for _ in range(12):
        flicker.append(stack_label(ce, "flicker Ce*"))
        flicker.append(stack_label(cs, "flicker Cs original"))
    write_clip(flicker, DIAG / "flicker-control.mp4")
    flicker = []
    for _ in range(12):
        flicker.append(stack_label(ce, "flicker Ce*"))
        flicker.append(stack_label(warped_st, "flicker Cs scale+xy"))
    write_clip(flicker, DIAG / "flicker-scale-trans.mp4")

    incoming = decode_range(bc_to_star, max(0, CE_STAR + 1 - INCOMING_KEEP), INCOMING_KEEP)
    cap = cv2.VideoCapture(str(cd_to_star))
    outgoing_full = []
    while True:
        ok, fr = cap.read()
        if not ok:
            break
        outgoing_full.append(cv2.cvtColor(fr, cv2.COLOR_BGR2RGB))
    cap.release()
    outgoing_watch = outgoing_full[:OUTGOING_WATCH]

    def seam_clip(out_frames: list[np.ndarray], label: str, path: Path, watch_only: bool = True) -> None:
        body = incoming + (out_frames[:OUTGOING_WATCH] if watch_only else out_frames)
        labeled = [stack_label(fr, label) for fr in body]
        write_clip(labeled, path)

    seam_clip(outgoing_watch, "CONTROL  Ce* | original Cs", CLIPS / "control-C-seam.mp4")
    static_so = apply_clip(outgoing_full, so_ref["scale"], so_ref["dx"], so_ref["dy"], None)
    static_st = apply_clip(outgoing_full, st_ref["scale"], st_ref["dx"], st_ref["dy"], None)
    seam_clip(static_so, f"STATIC scale-only s={so_ref['scale']:.4f}", CLIPS / "static-scale-only.mp4")
    seam_clip(static_st, f"STATIC scale+xy s={st_ref['scale']:.4f}", CLIPS / "static-scale-trans.mp4")

    improved = metrics_st["ssim"] - control["ssim"] >= 0.04 or control["mae"] - metrics_st["mae"] >= 2.5
    decay_paths = {}
    if improved:
        for n in (3, 5, 8):
            dec = apply_clip(outgoing_full, st_ref["scale"], st_ref["dx"], st_ref["dy"], n)
            p = CLIPS / f"decay-{n}f.mp4"
            seam_clip(dec, f"DECAY {n}f linear to identity", p)
            decay_paths[str(n)] = str(p.relative_to(EXP))
            first_corr = compare(ce, dec[0])
            decay_paths[f"{n}_first_metrics"] = first_corr

    # Normal-speed sequential comparison
    seq = []
    for name, clip in [
        ("1 CONTROL", incoming + outgoing_watch),
        ("2 SCALE-ONLY STATIC", incoming + static_so[:OUTGOING_WATCH]),
        ("3 SCALE+XY STATIC", incoming + static_st[:OUTGOING_WATCH]),
    ]:
        for fr in clip:
            seq.append(stack_label(fr, name))
    if improved:
        for n in (3, 5, 8):
            dec = apply_clip(outgoing_watch, st_ref["scale"], st_ref["dx"], st_ref["dy"], n)
            for fr in incoming + dec:
                seq.append(stack_label(fr, f"{n}-FRAME DECAY"))
    write_clip(seq, CLIPS / "compare-sequential-normal.mp4")

    # Side-by-side control vs scale+xy (watch window)
    pair = []
    left = incoming + outgoing_watch
    right = incoming + static_st[:OUTGOING_WATCH]
    for a, b in zip(left, right):
        pair.append(np.hstack([stack_label(a, "CONTROL"), stack_label(b, "SCALE+XY STATIC")]))
    write_clip(pair, CLIPS / "compare-control-vs-scale-trans.mp4")

    report = {
        "experiment": "C-seam-geometric-registration",
        "kling_generations": 0,
        "camotion_generations": 0,
        "production_code_changed": False,
        "smart_prelock_baseline_altered": False,
        "fps": FPS,
        "resolution": [W, H],
        "touching_frames": {
            "incoming": "B-C take-01.mp4 frame 238 (Ce*)",
            "outgoing": "C-D take-01.mp4 frame 0 (Cs_rendered)",
            "identity": identity,
        },
        "control_Ce_vs_Cs": control,
        "registration": {
            "scale_only_ransac_all": so_all,
            "scale_only_ransac_architecture": so_arc,
            "scale_only_refined": so_ref,
            "scale_trans_ransac_all": {k: st_all[k] for k in st_all if k != "residuals"},
            "scale_trans_ransac_architecture": {k: st_arc[k] for k in st_arc if k != "residuals"},
            "scale_trans_refined": st_ref,
            "dx_pct_width": st_ref["dx"] / W * 100.0,
            "dy_pct_height": st_ref["dy"] / H * 100.0,
        },
        "aligned": {
            "scale_only": metrics_so,
            "scale_trans": metrics_st,
        },
        "c_prime_reference": {
            "note": "Camotion still, resized 1376x768 -> 1928x1072. Not the movie seam.",
            "ce_vs_Cprime": prime_vs_ce,
            "cs_vs_Cprime": prime_vs_cs,
            "literal241_vs_Cs": lit_vs_cs,
            "ce_vs_literal241": lit_vs_ce,
        },
        "discarded_incoming_trajectory": traj,
        "phase5_justified": improved,
        "decay_rendered": bool(decay_paths),
        "decay": decay_paths,
        "sources": {
            "bc": str(bc_src),
            "cd": str(cd_src),
            "bc_to_star": str(bc_to_star),
            "cd_to_star": str(cd_to_star),
            "ce_star": str(existing_ce),
            "cs_rendered": str(existing_cs),
            "c_prime": str(c_prime),
            "motion_csv": str(SRC / "curves/B-C/motion.csv"),
        },
    }
    (GEN / "metrics.json").write_text(json.dumps(report, indent=2) + "\n")
    print(json.dumps({
        "control_ssim": control["ssim"],
        "scale_only": so_ref,
        "scale_trans": st_ref,
        "aligned_ssim_so": metrics_so["ssim"],
        "aligned_ssim_st": metrics_st["ssim"],
        "phase5_justified": improved,
        "traj_scales": [t.get("registration", {}).get("scale") for t in traj],
    }, indent=2))


if __name__ == "__main__":
    main()
