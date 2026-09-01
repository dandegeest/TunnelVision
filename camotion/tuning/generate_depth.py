#!/usr/bin/env python3
"""Generate a Camotion-compatible near-weight depth map from an input image."""

from __future__ import annotations

import argparse
from pathlib import Path

import numpy as np
import torch
from PIL import Image
from transformers import AutoImageProcessor, AutoModelForDepthEstimation

MODEL_ID = "depth-anything/Depth-Anything-V2-Small-hf"


def _device() -> torch.device:
    if torch.backends.mps.is_available():
        return torch.device("mps")
    return torch.device("cpu")


def _native_depth_convention() -> str:
    return "larger values = nearer; smaller values = farther"


def _load_model():
    processor = AutoImageProcessor.from_pretrained(MODEL_ID)
    model = AutoModelForDepthEstimation.from_pretrained(MODEL_ID)
    model.to(_device())
    model.eval()
    return processor, model


def _depth_to_near_weight(depth: np.ndarray) -> np.ndarray:
    depth = np.asarray(depth, dtype=np.float32)
    depth_min = float(np.min(depth))
    depth_max = float(np.max(depth))
    if depth_max <= depth_min:
        return np.zeros_like(depth, dtype=np.float32)
    normalized = (depth - depth_min) / (depth_max - depth_min)
    # Depth Anything V2 outputs a relative depth map for this model/image pair.
    # After checking the actual values on 01.jpeg, the nearer regions map to larger
    # normalized values. Camotion expects white = near and black = far, so the
    # normalized depth is the correct near-weight signal without extra inversion.
    near_weight = normalized
    return np.clip(near_weight, 0.0, 1.0)


def generate_depth_map(input_path: str | Path, output_path: str | Path) -> None:
    input_path = Path(input_path)
    output_path = Path(output_path)
    output_path.parent.mkdir(parents=True, exist_ok=True)

    image = Image.open(input_path).convert("RGB")
    src_width, src_height = image.size

    processor, model = _load_model()
    device = _device()
    inputs = processor(images=image, return_tensors="pt").to(device)

    with torch.no_grad():
        outputs = model(**inputs)
        depth_map = outputs.predicted_depth[0].cpu().numpy()

    near_weight = _depth_to_near_weight(depth_map)
    gray = (near_weight * 255.0).round().astype(np.uint8)
    gray_image = Image.fromarray(gray, mode="L").resize((src_width, src_height), Image.Resampling.BILINEAR)
    gray_image.save(output_path, format="PNG")

    print(f"input_path={input_path}")
    print(f"input_size={src_width}x{src_height}")
    print(f"output_path={output_path}")
    print(f"output_size={gray_image.size[0]}x{gray_image.size[1]}")
    print(f"model_used={MODEL_ID}")
    print(f"native_depth_convention={_native_depth_convention()}")
    print(f"inversion_applied=False")
    print(f"normalization=0..1 near_weight where white=near (1.0), black=far (0.0)")


def main() -> None:
    parser = argparse.ArgumentParser(description="Generate a normalized near-weight depth map for Camotion tuning.")
    parser.add_argument("input_path", type=str, help="Path to the source image.")
    parser.add_argument("output_path", type=str, help="Path to save the grayscale depth PNG.")
    args = parser.parse_args()
    generate_depth_map(args.input_path, args.output_path)


if __name__ == "__main__":
    main()
