"""Optional depth estimator for product Camotion weighting.

Lives beside the renderer, not inside CameraMotionPlan. Failure is
non-fatal: callers omit ``--depth`` and Camotion falls back to dest/VP
weights only.

Depth Anything V2 Small on this project is larger=nearer; we min-max
normalize without inversion (see ``tuning/generate_depth.py``).
"""

from __future__ import annotations

import argparse
import sys
from pathlib import Path

import numpy as np
from PIL import Image

from camotion.depth import normalize_relative_depth, resize_near_weight

MODEL_ID = "depth-anything/Depth-Anything-V2-Small-hf"
# Inference working size. Weights are bilinear-mapped back to canonical.
MAX_INFERENCE_EDGE = 1024


def fit_inference_size(width: int, height: int, max_edge: int = MAX_INFERENCE_EDGE) -> tuple[int, int]:
    longest = max(width, height)
    if longest <= max_edge:
        return width, height
    scale = max_edge / float(longest)
    return max(1, int(round(width * scale))), max(1, int(round(height * scale)))


def estimate_near_weight(image: np.ndarray) -> np.ndarray:
    """Return a canonical-resolution near-weight map, or raise on failure."""
    array = np.asarray(image)
    if array.ndim == 2:
        rgb = np.stack([array, array, array], axis=-1)
    elif array.ndim == 3 and array.shape[2] >= 3:
        rgb = array[..., :3]
    else:
        raise ValueError("depth estimation expects H x W or H x W x C")
    height = int(rgb.shape[0])
    width = int(rgb.shape[1])
    work_w, work_h = fit_inference_size(width, height)
    pixels = np.asarray(rgb)
    if np.issubdtype(pixels.dtype, np.floating):
        pixels = np.clip(pixels * 255.0, 0, 255).astype(np.uint8)
    else:
        pixels = np.asarray(pixels, dtype=np.uint8)
    working = Image.fromarray(pixels, mode="RGB")
    if (work_w, work_h) != (width, height):
        working = working.resize((work_w, work_h), Image.Resampling.BILINEAR)

    try:
        import torch
        from transformers import AutoImageProcessor, AutoModelForDepthEstimation
    except ImportError as exc:
        raise RuntimeError("depth estimator dependencies are unavailable") from exc

    device = torch.device("mps") if torch.backends.mps.is_available() else torch.device("cpu")
    processor = AutoImageProcessor.from_pretrained(MODEL_ID)
    model = AutoModelForDepthEstimation.from_pretrained(MODEL_ID)
    model.to(device)
    model.eval()
    inputs = processor(images=working, return_tensors="pt").to(device)
    with torch.no_grad():
        predicted = model(**inputs).predicted_depth[0].detach().cpu().numpy()
    near = normalize_relative_depth(predicted, invert=False)
    return resize_near_weight(near, width, height)


def write_near_weight_png(path: Path | str, near_weight: np.ndarray) -> None:
    array = np.clip(np.asarray(near_weight, dtype=np.float64), 0.0, 1.0)
    gray = (array * 255.0).round().astype(np.uint8)
    Image.fromarray(gray, mode="L").save(path)


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(
        description="Estimate a Camotion near-weight depth map (0=far, 1=near).",
    )
    parser.add_argument("--image", required=True, type=Path)
    parser.add_argument("--output", required=True, type=Path)
    args = parser.parse_args(argv)
    if not args.image.is_file():
        print(f"error: image not found: {args.image}", file=sys.stderr)
        return 1
    try:
        with Image.open(args.image) as im:
            im.load()
            rgb = np.array(im.convert("RGB"))
        near = estimate_near_weight(rgb)
        args.output.parent.mkdir(parents=True, exist_ok=True)
        write_near_weight_png(args.output, near)
    except Exception as exc:
        print(f"error: {exc}", file=sys.stderr)
        return 1
    print(f"Wrote {args.output}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
