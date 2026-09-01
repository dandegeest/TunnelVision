"""Camotion CLI: render a still from an image and a CameraMotionPlan."""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

import numpy as np
from PIL import Image, UnidentifiedImageError
from pydantic import ValidationError

from camotion.depth import load_near_weight
from camotion.plan import load_plan
from camotion.render import render

_SUPPORTED_MODES = frozenset({"L", "RGB", "RGBA"})


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        prog="camotion",
        description="Condition a still for forward camera motion from a CameraMotionPlan.",
    )
    parser.add_argument("--image", required=True, type=Path, help="Source PNG or JPEG")
    parser.add_argument(
        "--plan",
        required=True,
        type=Path,
        help="CameraMotionPlan v1 JSON file",
    )
    parser.add_argument("--output", required=True, type=Path, help="Output PNG path")
    parser.add_argument(
        "--depth",
        type=Path,
        default=None,
        help="Optional near-weight / depth image (white=near/full motion, black=far/none)",
    )
    return parser


def _load_image(path: Path) -> np.ndarray:
    with Image.open(path) as im:
        im.load()
        if im.mode == "P":
            im = im.convert("RGBA" if "transparency" in im.info else "RGB")
        elif im.mode == "1":
            im = im.convert("L")
        elif im.mode not in _SUPPORTED_MODES:
            raise ValueError(
                f"unsupported image mode {im.mode}; expected L, RGB, or RGBA"
            )
        return np.array(im)


def _save_image(path: Path, array: np.ndarray) -> None:
    array = np.asarray(array)
    if array.ndim == 2:
        image = Image.fromarray(array, mode="L")
    elif array.ndim == 3 and array.shape[2] == 3:
        image = Image.fromarray(array, mode="RGB")
    elif array.ndim == 3 and array.shape[2] == 4:
        image = Image.fromarray(array, mode="RGBA")
    else:
        raise ValueError(
            f"cannot save image with shape {array.shape}; expected H x W, H x W x 3, or H x W x 4"
        )
    image.save(path)


def main(argv: list[str] | None = None) -> int:
    args = build_parser().parse_args(argv)

    if not args.image.is_file():
        print(f"error: image not found: {args.image}", file=sys.stderr)
        return 1
    if not args.plan.is_file():
        print(f"error: plan not found: {args.plan}", file=sys.stderr)
        return 1
    if args.depth is not None and not args.depth.is_file():
        print(f"error: depth not found: {args.depth}", file=sys.stderr)
        return 1

    try:
        plan = load_plan(args.plan)
    except OSError as exc:
        print(f"error: cannot read plan: {exc}", file=sys.stderr)
        return 1
    except json.JSONDecodeError as exc:
        print(f"error: plan is not valid JSON: {exc}", file=sys.stderr)
        return 1
    except ValidationError as exc:
        print("error: invalid CameraMotionPlan:", file=sys.stderr)
        print(exc, file=sys.stderr)
        return 1

    try:
        image = _load_image(args.image)
    except UnidentifiedImageError as exc:
        print(f"error: cannot read image: {exc}", file=sys.stderr)
        return 1
    except OSError as exc:
        print(f"error: cannot read image: {exc}", file=sys.stderr)
        return 1
    except ValueError as exc:
        print(f"error: {exc}", file=sys.stderr)
        return 1

    near_weight = None
    if args.depth is not None:
        try:
            near_weight = load_near_weight(args.depth)
        except UnidentifiedImageError as exc:
            print(f"error: cannot read depth: {exc}", file=sys.stderr)
            return 1
        except OSError as exc:
            print(f"error: cannot read depth: {exc}", file=sys.stderr)
            return 1
        except ValueError as exc:
            print(f"error: {exc}", file=sys.stderr)
            return 1

    try:
        output = render(image, plan, near_weight=near_weight)
        _save_image(args.output, output)
    except OSError as exc:
        print(f"error: cannot write output: {exc}", file=sys.stderr)
        return 1
    except ValueError as exc:
        print(f"error: {exc}", file=sys.stderr)
        return 1

    print(f"Wrote {args.output}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
