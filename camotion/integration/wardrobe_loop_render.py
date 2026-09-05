"""Render 01.8 route-preserved shooting frames for the wardrobe-loop integration test.

Does not change default ``render()``, CameraMotionPlan v1, or the 01.8 operator.
"""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

import numpy as np
from PIL import Image

_SRC = Path(__file__).resolve().parents[1] / "src"
_TUNING = Path(__file__).resolve().parents[1] / "tuning"
if str(_SRC) not in sys.path:
    sys.path.insert(0, str(_SRC))
if str(_TUNING) not in sys.path:
    sys.path.insert(0, str(_TUNING))

from camotion.__main__ import _load_image, _save_image  # noqa: E402
from camotion.depth import load_near_weight  # noqa: E402
from camotion.experimental_composite import render_depth_banded  # noqa: E402
from camotion.plan import CameraMotionPlan, load_plan  # noqa: E402
from generate_depth import generate_depth_map  # noqa: E402

VISION_MAX_BYTES = 6_500_000
VISION_MAX_EDGE = 1600


def _write_vision_jpeg(source: Path, output: Path) -> None:
    output.parent.mkdir(parents=True, exist_ok=True)
    with Image.open(source) as image:
        rgb = image.convert("RGB")
        width, height = rgb.size
        scale = min(1.0, VISION_MAX_EDGE / max(width, height))
        if scale < 1.0:
            rgb = rgb.resize(
                (max(1, int(width * scale)), max(1, int(height * scale))),
                Image.Resampling.BILINEAR,
            )
        quality = 90
        while quality >= 50:
            rgb.save(output, format="JPEG", quality=quality, optimize=True)
            if output.stat().st_size <= VISION_MAX_BYTES:
                return
            quality -= 10
        rgb.save(output, format="JPEG", quality=40, optimize=True)


def _render_01_8(image_path: Path, plan_path: Path, depth_path: Path, output_path: Path) -> None:
    plan = load_plan(plan_path)
    CameraMotionPlan.model_validate(json.loads(plan_path.read_text(encoding="utf-8")))
    image = _load_image(image_path)
    near_weight = load_near_weight(depth_path)
    output = render_depth_banded(
        image,
        plan,
        near_weight,
        route_preservation=True,
        adaptive_exposure=False,
        terminal_at_canonical=False,
    )
    output_path.parent.mkdir(parents=True, exist_ok=True)
    _save_image(output_path, np.asarray(output))


def main() -> int:
    parser = argparse.ArgumentParser(description="01.8 wardrobe-loop Camotion helper")
    parser.add_argument("--jobs", required=True, type=Path)
    args = parser.parse_args()
    jobs = json.loads(args.jobs.read_text(encoding="utf-8"))

    for depth in jobs.get("depths", []):
        image = Path(depth["image"])
        output = Path(depth["output"])
        if output.is_file():
            print(f"skip_depth {output}")
            continue
        generate_depth_map(image, output)
        print(f"wrote_depth {output}")

    for vision in jobs.get("vision", []):
        source = Path(vision["image"])
        output = Path(vision["output"])
        if output.is_file():
            print(f"skip_vision {output}")
            continue
        _write_vision_jpeg(source, output)
        print(f"wrote_vision {output}")

    for render in jobs.get("renders", []):
        output = Path(render["output"])
        if output.is_file():
            print(f"skip_render {output}")
            continue
        _render_01_8(
            Path(render["image"]),
            Path(render["plan"]),
            Path(render["depth"]),
            output,
        )
        print(f"wrote_render {output}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
