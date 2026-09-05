#!/usr/bin/env python3
"""01.12 baked-exposure operating window (diagnostic only).

Eight exposure-only conditions: strengths 0.02/0.04/0.06/0.08 ×
pristine / sigma=1. Uses existing 01.8 fixed-16 gather. Does not
change CameraMotionPlan or default ``render()``.
"""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageFont

_SRC = Path(__file__).resolve().parents[1] / "src"
if str(_SRC) not in sys.path:
    sys.path.insert(0, str(_SRC))

from camotion.__main__ import _load_image, _save_image  # noqa: E402
from camotion.exposure import apply_multisample_exposure  # noqa: E402
from camotion.exposure_characterization import (  # noqa: E402
    energy_stats,
    extract_box,
)
from camotion.flow import forward_radial_motion_field  # noqa: E402
from camotion.operating_window import (  # noqa: E402
    BANDWIDTHS,
    PREFILTER_SIGMA,
    SAMPLES,
    STRENGTHS,
    apply_operating_window_exposure,
    condition_name,
    mean_gradient_magnitude,
    path_length_summary,
    path_lengths_for_strength,
)
from camotion.plan import load_plan  # noqa: E402

TUNING = Path(__file__).resolve().parent
ANALYSIS = TUNING / "analysis" / "01.12"
CONFIG_PATH = TUNING / "01.12-operating-window-config.json"
THUMB_WIDTH = 480


def _as_uint8_rgb(image: np.ndarray) -> np.ndarray:
    array = np.asarray(image)
    if array.ndim == 2:
        if np.issubdtype(array.dtype, np.floating):
            array = np.clip(np.rint(array), 0, 255).astype(np.uint8)
        else:
            array = np.clip(array, 0, 255).astype(np.uint8)
        return np.stack([array, array, array], axis=-1)
    if np.issubdtype(array.dtype, np.floating):
        array = np.clip(np.rint(array), 0, 255).astype(np.uint8)
    else:
        array = np.clip(array, 0, 255).astype(np.uint8)
    return array[..., :3]


def _thumb(image: np.ndarray, width: int = THUMB_WIDTH) -> Image.Image:
    rgb = Image.fromarray(_as_uint8_rgb(image), mode="RGB")
    height = max(1, int(round(rgb.height * (width / rgb.width))))
    return rgb.resize((width, height), Image.Resampling.BILINEAR)


def _grid(
    cells: list[list[tuple[str, np.ndarray]]],
    path: Path,
    *,
    title: str,
) -> None:
    pil_rows: list[list[tuple[str, Image.Image]]] = []
    cell_w = 0
    cell_h = 0
    for row in cells:
        converted = []
        for label, image in row:
            rgb = Image.fromarray(_as_uint8_rgb(image), mode="RGB")
            converted.append((label, rgb))
            cell_w = max(cell_w, rgb.width)
            cell_h = max(cell_h, rgb.height)
        pil_rows.append(converted)
    label_h = 18
    title_h = 22
    cols = max(len(row) for row in pil_rows)
    canvas = Image.new(
        "RGB",
        (cols * cell_w, title_h + len(pil_rows) * (cell_h + label_h)),
        (12, 12, 12),
    )
    draw = ImageDraw.Draw(canvas)
    font = ImageFont.load_default()
    draw.text((6, 4), title, fill=(230, 230, 230), font=font)
    for row_index, row in enumerate(pil_rows):
        y = title_h + row_index * (cell_h + label_h)
        for col_index, (label, rgb) in enumerate(row):
            x = col_index * cell_w
            canvas.paste(rgb, (x, y))
            draw.text((x + 4, y + cell_h + 2), label, fill=(220, 220, 220), font=font)
    canvas.save(path)


def main() -> int:
    parser = argparse.ArgumentParser(description="01.12 baked-exposure operating window")
    parser.add_argument("--image", type=Path, default=TUNING / "01.jpeg")
    parser.add_argument("--plan", type=Path, default=TUNING / "01.4-plan.json")
    parser.add_argument("--config", type=Path, default=CONFIG_PATH)
    parser.add_argument("--output-dir", type=Path, default=ANALYSIS)
    args = parser.parse_args()

    config = json.loads(args.config.read_text())
    crops: dict[str, dict[str, int]] = config["crops"]
    args.output_dir.mkdir(parents=True, exist_ok=True)
    crop_dir = args.output_dir / "crops"
    crop_dir.mkdir(parents=True, exist_ok=True)

    plan = load_plan(args.plan)
    source = _load_image(args.image)
    height, width = source.shape[:2]
    field = forward_radial_motion_field(
        width,
        height,
        plan.camera.vanishing_point,
        plan.camera.forward,
    )

    written: list[str] = []
    path_stats: dict[str, dict[str, Any]] = {}
    crop_path_stats: dict[str, dict[str, dict[str, float]]] = {}
    results: dict[str, dict[str, np.ndarray]] = {bandwidth: {} for bandwidth in BANDWIDTHS}
    condition_energy: dict[str, dict[str, Any]] = {}
    crop_energy: dict[str, dict[str, dict[str, Any]]] = {
        name: {} for name in crops
    }

    source_path = args.output_dir / "01.12-00-source.png"
    _save_image(source_path, source)
    written.append(str(source_path.relative_to(TUNING.parent.parent)))

    for strength in STRENGTHS:
        lengths = path_lengths_for_strength(field, strength)
        key = f"{strength:.2f}"
        path_stats[key] = path_length_summary(lengths)
        crop_path_stats[key] = {}
        for crop_name, box in crops.items():
            crop_path_stats[key][crop_name] = path_length_summary(extract_box(lengths, box))

    committed_strong = TUNING / "analysis" / "01.10" / "01.10-01-strong-exposure.png"
    matches_01_10 = False

    thumb_rows: list[list[tuple[str, np.ndarray]]] = []
    for strength in STRENGTHS:
        thumb_row: list[tuple[str, np.ndarray]] = []
        for bandwidth in BANDWIDTHS:
            exposed = apply_operating_window_exposure(
                source, field, strength, bandwidth, samples=SAMPLES
            )
            results[bandwidth][strength] = exposed
            name = condition_name(strength, bandwidth)
            out = args.output_dir / f"01.12-{name}.png"
            _save_image(out, exposed)
            written.append(str(out.relative_to(TUNING.parent.parent)))
            condition_energy[name] = {
                **energy_stats(exposed),
                "mean_gradient": mean_gradient_magnitude(exposed),
            }
            if strength == 0.08 and bandwidth == "pristine" and committed_strong.is_file():
                matches_01_10 = bool(np.array_equal(exposed, _load_image(committed_strong)))
            thumb = np.asarray(_thumb(exposed))
            thumb_row.append((f"{strength:.2f} {bandwidth}", thumb))
            for crop_name, box in crops.items():
                crop = extract_box(exposed, box)
                crop_out = crop_dir / f"01.12-crop-{crop_name}-{name}.png"
                _save_image(crop_out, crop)
                written.append(str(crop_out.relative_to(TUNING.parent.parent)))
                crop_energy[crop_name][name] = {
                    **energy_stats(crop),
                    "mean_gradient": mean_gradient_magnitude(crop),
                }
        thumb_rows.append(thumb_row)

    matrix_path = args.output_dir / "01.12-matrix-thumbs.png"
    _grid(thumb_rows, matrix_path, title="01.12 Ghost Library exposure-only  rows=strength  cols=pristine|sigma=1")
    written.append(str(matrix_path.relative_to(TUNING.parent.parent)))

    for crop_name, box in crops.items():
        source_crop = extract_box(source, box)
        src_out = crop_dir / f"01.12-crop-{crop_name}-00-source.png"
        _save_image(src_out, source_crop)
        written.append(str(src_out.relative_to(TUNING.parent.parent)))
        rows = []
        for strength in STRENGTHS:
            rows.append(
                [
                    (
                        f"{strength:.2f} pristine",
                        results["pristine"][strength][
                            box["y"] : box["y"] + box["height"],
                            box["x"] : box["x"] + box["width"],
                        ],
                    ),
                    (
                        f"{strength:.2f} sigma=1",
                        results["sigma1"][strength][
                            box["y"] : box["y"] + box["height"],
                            box["x"] : box["x"] + box["width"],
                        ],
                    ),
                ]
            )
        crop_sheet = args.output_dir / f"01.12-contact-{crop_name}.png"
        _grid(rows, crop_sheet, title=f"01.12 {crop_name}  rows=strength  cols=pristine|sigma=1")
        written.append(str(crop_sheet.relative_to(TUNING.parent.parent)))

    analysis = {
        "experiment": "01.12-operating-window",
        "not_a_new_renderer_version": True,
        "operator": "apply_multisample_exposure N=16 outgoing dest-gather",
        "strengths": list(STRENGTHS),
        "bandwidths": list(BANDWIDTHS),
        "prefilter_sigma": PREFILTER_SIGMA,
        "prefilter_is_diagnostic_control": True,
        "samples": SAMPLES,
        "ghost_library": {
            "vanishing_point": list(plan.camera.vanishing_point),
            "forward": float(plan.camera.forward),
            "image_shape": [height, width, int(source.shape[2])],
            "s008_pristine_matches_01_10_strong_exposure": matches_01_10,
        },
        "path_length_pixels": path_stats,
        "crop_path_length_pixels": crop_path_stats,
        "condition_energy": condition_energy,
        "crop_energy": crop_energy,
        "artifacts": written,
        "visual_judgments": {
            "status": "pending_visual_inspection",
            "copies": None,
            "motion_cue": None,
            "sigma1_effect": None,
        },
        "classification": {
            "status": "pending_visual_inspection",
            "letters": None,
            "decision_answers": None,
            "hypothesis_for_next": None,
        },
    }
    analysis_path = TUNING / "analysis" / "01.12-operating-window.json"
    analysis_path.write_text(json.dumps(analysis, indent=2) + "\n")
    print(f"Wrote {analysis_path}")
    print(f"s008_pristine_matches_01_10={matches_01_10}")
    for strength in STRENGTHS:
        stats = path_stats[f"{strength:.2f}"]
        print(
            f"strength={strength:.2f} mean={stats['mean']:.2f} "
            f"median={stats['median']:.2f} p90={stats['p90']:.2f} "
            f"p95={stats['p95']:.2f} max={stats['max']:.2f}"
        )
    # Keep the 01.8 gather import used so a mismatch is loud if the runner drifts.
    assert np.array_equal(
        results["pristine"][0.08],
        apply_multisample_exposure(source, field, 0.08, SAMPLES),
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
