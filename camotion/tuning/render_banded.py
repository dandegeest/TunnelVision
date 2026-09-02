#!/usr/bin/env python3
"""Render the experimental depth-banded compositor on a tuning fixture.

Does not change ``python -m camotion`` default behavior.
"""

from __future__ import annotations

import argparse
import sys
from pathlib import Path

import numpy as np
from PIL import Image

_SRC = Path(__file__).resolve().parents[1] / "src"
if str(_SRC) not in sys.path:
    sys.path.insert(0, str(_SRC))

from camotion.__main__ import _load_image, _save_image  # noqa: E402
from camotion.depth import load_near_weight  # noqa: E402
from camotion.experimental_composite import render_depth_banded  # noqa: E402
from camotion.plan import load_plan  # noqa: E402


def _save_mask(path: Path, mask: np.ndarray) -> None:
    gray = np.clip(np.rint(np.asarray(mask, dtype=np.float64) * 255.0), 0, 255).astype(
        np.uint8
    )
    Image.fromarray(gray, mode="L").save(path)


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Experimental depth-banded Camotion render (not the default renderer)."
    )
    parser.add_argument("--image", required=True, type=Path)
    parser.add_argument("--plan", required=True, type=Path)
    parser.add_argument("--depth", required=True, type=Path)
    parser.add_argument("--output", required=True, type=Path)
    parser.add_argument(
        "--diagnostics",
        type=Path,
        default=None,
        help="Directory for experimental mask PNGs (optional).",
    )
    parser.add_argument(
        "--terminal-at-canonical",
        action="store_true",
        help=(
            "Use opposite exposure sample set (p + field*t) for strong/medium "
            "images and the strong mask. Default is the 01.5 outgoing set."
        ),
    )
    args = parser.parse_args()

    plan = load_plan(args.plan)
    image = _load_image(args.image)
    near_weight = load_near_weight(args.depth)
    output, diagnostics = render_depth_banded(
        image,
        plan,
        near_weight,
        return_diagnostics=True,
        terminal_at_canonical=args.terminal_at_canonical,
    )
    args.output.parent.mkdir(parents=True, exist_ok=True)
    _save_image(args.output, output)
    print(f"Wrote {args.output}")
    print(
        "near_weight_file="
        f"{args.depth} polarity=white=near/1.0 black=far/0.0 "
        f"min={float(near_weight.min()):.4f} max={float(near_weight.max()):.4f} "
        f"mean={float(near_weight.mean()):.4f}"
    )
    print(
        "exposure_orientation="
        + (
            "terminal_at_canonical (p + field*t)"
            if args.terminal_at_canonical
            else "origin_at_canonical (p - field*t)"
        )
    )

    if args.diagnostics is not None:
        args.diagnostics.mkdir(parents=True, exist_ok=True)
        stem = args.output.stem.removesuffix("-result")
        paths = {
            f"{stem}-strong-mask-before.png": diagnostics["strong_mask_before"],
            f"{stem}-strong-mask-after.png": diagnostics["strong_mask_after"],
            f"{stem}-medium-mask.png": diagnostics["medium_mask"],
        }
        for name, mask in paths.items():
            path = args.diagnostics / name
            _save_mask(path, mask)
            print(f"Wrote {path}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
