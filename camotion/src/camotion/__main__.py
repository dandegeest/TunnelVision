"""Camotion CLI: validate a CameraMotionPlan; rendering is not implemented yet."""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

from pydantic import ValidationError

from camotion.plan import load_plan


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        prog="camotion",
        description=(
            "Condition a still for forward camera motion. "
            "v1 currently validates CameraMotionPlan JSON; rendering is not implemented yet."
        ),
    )
    parser.add_argument("--image", required=True, type=Path, help="Source PNG or JPEG")
    parser.add_argument(
        "--plan",
        required=True,
        type=Path,
        help="CameraMotionPlan v1 JSON file",
    )
    parser.add_argument("--output", required=True, type=Path, help="Output PNG path")
    return parser


def main(argv: list[str] | None = None) -> int:
    args = build_parser().parse_args(argv)

    if not args.image.is_file():
        print(f"error: image not found: {args.image}", file=sys.stderr)
        return 1
    if not args.plan.is_file():
        print(f"error: plan not found: {args.plan}", file=sys.stderr)
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

    print(f"Validated CameraMotionPlan v{plan.version}.")
    print("Rendering is not implemented yet.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
