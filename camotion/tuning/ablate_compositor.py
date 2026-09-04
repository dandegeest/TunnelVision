#!/usr/bin/env python3
"""01.10 diagnostic ablation of the 01.8 depth-banded compositor.

Does not change CameraMotionPlan, default ``render()``, or 01.8 output.
Always uses fixed 16-tap exposure. Does not enable 01.9 adaptive sampling.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import sys
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageFont

_SRC = Path(__file__).resolve().parents[1] / "src"
if str(_SRC) not in sys.path:
    sys.path.insert(0, str(_SRC))

from camotion.__main__ import _load_image, _save_image  # noqa: E402
from camotion.compositor_ablation import (  # noqa: E402
    MATERIAL_ACTIVE_THRESHOLD,
    collect_depth_banded_ablation,
    extract_crop,
    overlap_stats,
    reconstruct_from_weights,
    weight_stats,
    weight_sum_error,
)
from camotion.coordinates import normalized_bbox_to_pixel  # noqa: E402
from camotion.depth import load_near_weight  # noqa: E402
from camotion.experimental_composite import render_depth_banded  # noqa: E402
from camotion.plan import load_plan  # noqa: E402

TUNING = Path(__file__).resolve().parent
ANALYSIS_DIR = TUNING / "analysis" / "01.10"
CONFIG_PATH = TUNING / "01.10-compositor-ablation-config.json"

CONTACT_STAGES = (
    ("00_source", "source"),
    ("01_strong_exposure", "strong exposure"),
    ("02_medium_exposure", "medium exposure"),
    ("13_strong_plus_medium", "strong+medium"),
    ("16_full_depth_banded", "full depth-banded"),
    ("17_route_preserved", "route-preserved"),
    ("18_final_01_8", "final 01.8"),
)

PNG_OUTPUTS: tuple[tuple[str, str, str], ...] = (
    ("00_source", "01.10-00-source.png", "image"),
    ("01_strong_exposure", "01.10-01-strong-exposure.png", "image"),
    ("02_medium_exposure", "01.10-02-medium-exposure.png", "image"),
    ("03_raw_near_weight", "01.10-03-raw-near-weight.png", "mask"),
    ("04_strong_mask_before_motion", "01.10-04-strong-mask-before-motion-processing.png", "mask"),
    ("05_strong_mask_after_motion", "01.10-05-strong-mask-after-motion-processing.png", "mask"),
    ("05_strong_mask_after_route", "01.10-05-strong-mask-after-route.png", "mask"),
    ("06_medium_mask", "01.10-06-medium-mask.png", "mask"),
    ("06_medium_mask_after_route", "01.10-06-medium-mask-after-route.png", "mask"),
    ("07_effective_strong", "01.10-07-effective-strong-contribution.png", "mask"),
    ("08_effective_medium", "01.10-08-effective-medium-contribution.png", "mask"),
    ("09_effective_pristine", "01.10-09-effective-pristine-contribution.png", "mask"),
    ("07_effective_strong_after_route", "01.10-07-effective-strong-contribution-after-route.png", "mask"),
    ("08_effective_medium_after_route", "01.10-08-effective-medium-contribution-after-route.png", "mask"),
    ("09_effective_pristine_after_route", "01.10-09-effective-pristine-contribution-after-route.png", "mask"),
    ("10_strong_only", "01.10-10-strong-only.png", "image"),
    ("11_medium_only", "01.10-11-medium-only.png", "image"),
    ("12_pristine_only", "01.10-12-pristine-only.png", "image"),
    ("13_strong_plus_medium", "01.10-13-strong-plus-medium.png", "image"),
    ("14_strong_plus_pristine", "01.10-14-strong-plus-pristine.png", "image"),
    ("15_medium_plus_pristine", "01.10-15-medium-plus-pristine.png", "image"),
    ("16_full_depth_banded", "01.10-16-full-depth-banded.png", "image"),
    (
        "16_full_depth_banded_unexposed_strong_mask",
        "01.10-16-full-depth-banded-unexposed-strong-mask.png",
        "image",
    ),
    ("17_route_preserved", "01.10-17-route-preserved.png", "image"),
    ("18_final_01_8", "01.10-18-final-01.8.png", "image"),
    ("contribution_rgb", "01.10-contribution-rgb.png", "rgb01"),
    ("contribution_rgb_after_route", "01.10-contribution-rgb-after-route.png", "rgb01"),
    ("protection_mask", "01.10-destination-protection-mask.png", "mask"),
    ("route_preservation_mask", "01.10-route-preservation-mask.png", "mask"),
)


def _save_mask(path: Path, mask: np.ndarray) -> None:
    gray = np.clip(np.rint(np.asarray(mask, dtype=np.float64) * 255.0), 0, 255).astype(
        np.uint8
    )
    Image.fromarray(gray, mode="L").save(path)


def _save_rgb01(path: Path, rgb: np.ndarray) -> None:
    values = np.clip(np.rint(np.asarray(rgb, dtype=np.float64) * 255.0), 0, 255).astype(
        np.uint8
    )
    Image.fromarray(values, mode="RGB").save(path)


def _as_uint8_rgb(image: np.ndarray) -> np.ndarray:
    array = np.asarray(image)
    if array.ndim == 2:
        if np.issubdtype(array.dtype, np.floating):
            array = np.clip(np.rint(array * 255.0), 0, 255).astype(np.uint8)
        else:
            array = np.clip(array, 0, 255).astype(np.uint8)
        return np.stack([array, array, array], axis=-1)
    if np.issubdtype(array.dtype, np.floating):
        array = np.clip(np.rint(array * 255.0), 0, 255).astype(np.uint8)
    else:
        array = np.clip(array, 0, 255).astype(np.uint8)
    if array.shape[-1] == 4:
        return array[..., :3]
    return array


def _pair_metrics(a: np.ndarray, b: np.ndarray) -> dict[str, float]:
    left = np.asarray(a, dtype=np.float64)
    right = np.asarray(b, dtype=np.float64)
    delta = np.abs(left - right)
    return {
        "mae": float(delta.mean()),
        "rmse": float(np.sqrt(np.mean(delta * delta))),
        "max": float(delta.max()),
        "changed_pixel_fraction": float(np.any(left != right, axis=-1).mean())
        if left.ndim == 3
        else float((left != right).mean()),
        "identical": bool(np.array_equal(np.asarray(a), np.asarray(b))),
    }


def _sha256(path: Path) -> str:
    digest = hashlib.sha256()
    digest.update(path.read_bytes())
    return digest.hexdigest()


def _contact_sheet(
    states: dict[str, np.ndarray],
    crops: dict[str, dict],
    path: Path,
) -> None:
    samples = []
    for crop_name, box in crops.items():
        row = []
        for key, _label in CONTACT_STAGES:
            row.append(_as_uint8_rgb(extract_crop(states[key], box)))
        samples.append((crop_name, row))

    cell_h = max(row[0].shape[0] for _, row in samples)
    cell_w = max(row[0].shape[1] for _, row in samples)
    label_h = 28
    row_label_w = 168
    cols = len(CONTACT_STAGES)
    rows = len(samples)
    canvas = Image.new(
        "RGB",
        (row_label_w + cols * cell_w, (rows + 1) * (cell_h + label_h)),
        (18, 18, 18),
    )
    draw = ImageDraw.Draw(canvas)
    try:
        font = ImageFont.load_default()
    except OSError:
        font = None

    for col, (_key, label) in enumerate(CONTACT_STAGES):
        draw.text((row_label_w + col * cell_w + 6, 6), label, fill=(230, 230, 230), font=font)

    for row_index, (crop_name, tiles) in enumerate(samples):
        y = (row_index + 1) * (cell_h + label_h)
        draw.text((6, y + 8), crop_name, fill=(230, 230, 230), font=font)
        for col, tile in enumerate(tiles):
            x = row_label_w + col * cell_w
            canvas.paste(Image.fromarray(tile, mode="RGB"), (x, y))
    canvas.save(path)


def main() -> int:
    parser = argparse.ArgumentParser(description="01.10 01.8 compositor ablation (diagnostic only).")
    parser.add_argument("--image", type=Path, default=TUNING / "01.jpeg")
    parser.add_argument("--plan", type=Path, default=TUNING / "01.4-plan.json")
    parser.add_argument("--depth", type=Path, default=TUNING / "01-depth.png")
    parser.add_argument(
        "--committed-01-8",
        type=Path,
        default=TUNING / "01.8-route-preserved-result.png",
    )
    parser.add_argument("--output-dir", type=Path, default=ANALYSIS_DIR)
    parser.add_argument("--config", type=Path, default=CONFIG_PATH)
    args = parser.parse_args()

    config = json.loads(args.config.read_text())
    crops = config["crops"]
    threshold = float(config.get("material_active_threshold", MATERIAL_ACTIVE_THRESHOLD))

    plan = load_plan(args.plan)
    image = _load_image(args.image)
    near_weight = load_near_weight(args.depth)
    states = collect_depth_banded_ablation(image, plan, near_weight, route_preservation=True)

    expected = render_depth_banded(
        image,
        plan,
        near_weight,
        route_preservation=True,
        adaptive_exposure=False,
    )
    if not np.array_equal(states["18_final_01_8"], expected):
        raise SystemExit("01.10 final does not match render_depth_banded")

    committed = _load_image(args.committed_01_8)
    committed_identical = bool(np.array_equal(states["18_final_01_8"], committed))

    reconstructed = reconstruct_from_weights(
        states["00_source"],
        states["02_medium_exposure"],
        states["01_strong_exposure"],
        states["09_effective_pristine"],
        states["08_effective_medium"],
        states["07_effective_strong"],
    )
    reconstruction_max_abs = float(
        np.max(np.abs(reconstructed - states["pre_route_float"]))
    )

    args.output_dir.mkdir(parents=True, exist_ok=True)
    written: list[str] = []
    for key, filename, kind in PNG_OUTPUTS:
        if key not in states:
            continue
        path = args.output_dir / filename
        if kind == "mask":
            _save_mask(path, states[key])
        elif kind == "rgb01":
            _save_rgb01(path, states[key])
        else:
            _save_image(path, states[key])
        written.append(str(path.relative_to(TUNING.parent.parent)))

    npz_path = args.output_dir / "01.10-effective-contributions.npz"
    np.savez_compressed(
        npz_path,
        strong_pre_route=states["07_effective_strong"].astype(np.float32),
        medium_pre_route=states["08_effective_medium"].astype(np.float32),
        pristine_pre_route=states["09_effective_pristine"].astype(np.float32),
        strong_after_route=states["07_effective_strong_after_route"].astype(np.float32),
        medium_after_route=states["08_effective_medium_after_route"].astype(np.float32),
        pristine_after_route=states["09_effective_pristine_after_route"].astype(np.float32),
    )
    written.append(str(npz_path.relative_to(TUNING.parent.parent)))

    crop_dir = args.output_dir / "crops"
    crop_dir.mkdir(parents=True, exist_ok=True)
    crop_overlap: dict[str, dict] = {}
    crop_pairs: dict[str, dict] = {}
    for crop_name, box in crops.items():
        for key, label in CONTACT_STAGES:
            crop = extract_crop(states[key], box)
            path = crop_dir / f"01.10-crop-{crop_name}-{key.replace('_', '-')}.png"
            _save_image(path, crop)
            written.append(str(path.relative_to(TUNING.parent.parent)))
        w_s = extract_crop(states["07_effective_strong"], box)
        w_m = extract_crop(states["08_effective_medium"], box)
        w_p = extract_crop(states["09_effective_pristine"], box)
        crop_overlap[crop_name] = overlap_stats(w_s, w_m, w_p, threshold=threshold)
        crop_pairs[crop_name] = {
            "source_vs_strong": _pair_metrics(
                extract_crop(states["00_source"], box),
                extract_crop(states["01_strong_exposure"], box),
            ),
            "strong_vs_medium": _pair_metrics(
                extract_crop(states["01_strong_exposure"], box),
                extract_crop(states["02_medium_exposure"], box),
            ),
            "strong_plus_medium_vs_full": _pair_metrics(
                extract_crop(states["13_strong_plus_medium"], box),
                extract_crop(states["16_full_depth_banded"], box),
            ),
            "full_vs_route": _pair_metrics(
                extract_crop(states["16_full_depth_banded"], box),
                extract_crop(states["17_route_preserved"], box),
            ),
            "route_vs_final": _pair_metrics(
                extract_crop(states["17_route_preserved"], box),
                extract_crop(states["18_final_01_8"], box),
            ),
            "unexposed_strong_mask_vs_full": _pair_metrics(
                extract_crop(states["16_full_depth_banded_unexposed_strong_mask"], box),
                extract_crop(states["16_full_depth_banded"], box),
            ),
        }

    sheet_path = args.output_dir / "01.10-contact-sheet.png"
    _contact_sheet(states, crops, sheet_path)
    written.append(str(sheet_path.relative_to(TUNING.parent.parent)))

    dest_bbox = None
    dest_stats = None
    if plan.destination is not None and plan.destination.bbox is not None:
        dest_bbox = tuple(float(v) for v in plan.destination.bbox)
        left, top, right, bottom = normalized_bbox_to_pixel(
            dest_bbox, image.shape[1], image.shape[0]
        )
        x0 = int(round(left))
        y0 = int(round(top))
        x1 = int(round(right)) + 1
        y1 = int(round(bottom)) + 1
        dest_box = {"x": x0, "y": y0, "width": x1 - x0, "height": y1 - y0}
        dest_stats = {
            "pixel_box": dest_box,
            "normalized_bbox": list(dest_bbox),
            "source_vs_final": _pair_metrics(
                extract_crop(image, dest_box),
                extract_crop(states["18_final_01_8"], dest_box),
            ),
            "route_vs_final": _pair_metrics(
                extract_crop(states["17_route_preserved"], dest_box),
                extract_crop(states["18_final_01_8"], dest_box),
            ),
            "protection_mask": weight_stats(
                extract_crop(states["protection_mask"], dest_box)
            ),
        }

    analysis = {
        "experiment": "01.10-compositor-ablation",
        "control": "01.8-route-preserved",
        "not_a_new_renderer_version": True,
        "adaptive_exposure": False,
        "image_shape": list(image.shape),
        "pipeline_order_from_code": [
            "source",
            "strong exposure (fixed 16-tap apply_multisample_exposure)",
            "medium exposure (fixed 16-tap, strength * 8/12)",
            "strong mask before motion = gaussian(near_weight, sigma=10)",
            "strong mask after motion = expose(that gaussian, same field/strength/samples)",
            "medium mask = gaussian(near-to-mid ramp, sigma=2)",
            "route preservation attenuates strong and medium masks (pre-composite)",
            "composite: strong over (medium over pristine)",
            "destination-protection blend of pristine over that composite",
        ],
        "naming_notes": {
            "06_medium_mask": "medium_visibility_mask output, before route attenuation",
            "06_medium_mask_after_route": "mask actually used by 01.8 compositing",
            "07_08_09": "pre-route effective weights used by 10-16 (depth compositor isolation)",
            "07_08_09_after_route": "effective weights used by 17/18 after 01.8 route attenuation",
            "16_unexposed_strong_mask": "same compositor as 16, but strong mask is 04 not 05",
        },
        "byte_identical_to_committed_01_8": committed_identical,
        "byte_identical_to_render_depth_banded": True,
        "committed_01_8_png_sha256": _sha256(args.committed_01_8),
        "final_18_png_sha256": _sha256(args.output_dir / "01.10-18-final-01.8.png"),
        "png_byte_identical_to_committed_01_8": _sha256(args.committed_01_8)
        == _sha256(args.output_dir / "01.10-18-final-01.8.png"),
        "pre_route_weight_stats": {
            "strong": weight_stats(states["07_effective_strong"]),
            "medium": weight_stats(states["08_effective_medium"]),
            "pristine": weight_stats(states["09_effective_pristine"]),
        },
        "after_route_weight_stats": {
            "strong": weight_stats(states["07_effective_strong_after_route"]),
            "medium": weight_stats(states["08_effective_medium_after_route"]),
            "pristine": weight_stats(states["09_effective_pristine_after_route"]),
        },
        "pre_route_weight_sum": weight_sum_error(
            states["07_effective_strong"],
            states["08_effective_medium"],
            states["09_effective_pristine"],
        ),
        "after_route_weight_sum": weight_sum_error(
            states["07_effective_strong_after_route"],
            states["08_effective_medium_after_route"],
            states["09_effective_pristine_after_route"],
        ),
        "pre_route_overlap": overlap_stats(
            states["07_effective_strong"],
            states["08_effective_medium"],
            states["09_effective_pristine"],
            threshold=threshold,
        ),
        "after_route_overlap": overlap_stats(
            states["07_effective_strong_after_route"],
            states["08_effective_medium_after_route"],
            states["09_effective_pristine_after_route"],
            threshold=threshold,
        ),
        "reconstruction_max_abs_error": reconstruction_max_abs,
        "pairs": {
            "full_vs_route": _pair_metrics(
                states["16_full_depth_banded"], states["17_route_preserved"]
            ),
            "route_vs_final": _pair_metrics(
                states["17_route_preserved"], states["18_final_01_8"]
            ),
            "unexposed_strong_mask_vs_full": _pair_metrics(
                states["16_full_depth_banded_unexposed_strong_mask"],
                states["16_full_depth_banded"],
            ),
            "strong_vs_medium_exposure": _pair_metrics(
                states["01_strong_exposure"], states["02_medium_exposure"]
            ),
        },
        "destination_protection": dest_stats,
        "crop_overlap_pre_route": crop_overlap,
        "crop_pairs": crop_pairs,
        "artifacts": written,
        "classification": {
            "status": "pending_visual_inspection",
            "letter": None,
            "first_stage": None,
            "hypothesis_for_01_11": None,
        },
    }
    analysis_path = TUNING / "analysis" / "01.10-compositor-ablation.json"
    if analysis_path.is_file():
        previous = json.loads(analysis_path.read_text())
        if previous.get("classification"):
            analysis["classification"] = previous["classification"]
        if previous.get("visual_observations"):
            analysis["visual_observations"] = previous["visual_observations"]
    analysis_path.write_text(json.dumps(analysis, indent=2) + "\n")
    print(f"Wrote {analysis_path}")
    print(f"committed_identical={committed_identical}")
    print(f"reconstruction_max_abs_error={reconstruction_max_abs}")
    print(f"pre_route_weight_sum={analysis['pre_route_weight_sum']}")
    print(f"pre_route_overlap={analysis['pre_route_overlap']}")
    print(f"full_vs_route mae={analysis['pairs']['full_vs_route']['mae']}")
    print(f"route_vs_final mae={analysis['pairs']['route_vs_final']['mae']}")
    return 0 if committed_identical else 1


if __name__ == "__main__":
    raise SystemExit(main())
