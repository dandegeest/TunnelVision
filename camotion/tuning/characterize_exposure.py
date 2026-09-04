#!/usr/bin/env python3
"""01.11 exposure-operator characterization (diagnostic only).

Does not change CameraMotionPlan, default ``render()``, or 01.8/01.9
gather implementations.
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
from camotion.exposure import (  # noqa: E402
    apply_multisample_exposure,
    exposure_path_length_pixels,
)
from camotion.exposure_characterization import (  # noqa: E402
    CROP_PAD_PIXELS,
    GHOST_LIBRARY_SAMPLES,
    GHOST_LIBRARY_STRENGTH,
    OPERATORS,
    PREFILTER_SIGMA,
    SYNTHETIC_FORWARD,
    SYNTHETIC_POINT_XY,
    SYNTHETIC_SIZE,
    SYNTHETIC_STRENGTH,
    SYNTHETIC_VANISHING_POINT,
    apply_named_operator,
    energy_stats,
    extract_box,
    luminance,
    make_synthetic_fixture,
    padded_crop_box,
    point_smear_segment,
    profile_metrics,
    sample_profile_along_segment,
    synthetic_motion_field,
)
from camotion.flow import forward_radial_motion_field  # noqa: E402
from camotion.plan import load_plan  # noqa: E402

TUNING = Path(__file__).resolve().parent
ANALYSIS = TUNING / "analysis" / "01.11"
CONFIG_PATH = TUNING / "01.11-exposure-characterization-config.json"
OPERATOR_ORDER = (
    "01_fixed_16_box",
    "02_dense_box",
    "03_weighted_dense",
    "04_forward_line",
    "05_prefilter_dense",
)


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


def _profile_strip(profile: np.ndarray, height: int = 48) -> np.ndarray:
    values = np.asarray(profile, dtype=np.float64)
    peak = float(values.max()) if values.size else 1.0
    if peak <= 0.0:
        peak = 1.0
    width = max(int(values.size), 2)
    strip = np.zeros((height, width), dtype=np.uint8)
    scaled = np.clip(values / peak, 0.0, 1.0)
    for index, amount in enumerate(scaled):
        bar = max(1, int(round(amount * (height - 1))))
        strip[height - bar :, index] = 255
    return strip


def _contact_sheet(
    tiles: list[tuple[str, np.ndarray]],
    path: Path,
    *,
    title: str,
) -> None:
    rgb = [(_as_uint8_rgb(image), label) for label, image in tiles]
    cell_h = max(image.shape[0] for image, _label in rgb)
    cell_w = max(image.shape[1] for image, _label in rgb)
    label_h = 22
    cols = len(rgb)
    canvas = Image.new("RGB", (cols * cell_w, cell_h + label_h * 2), (12, 12, 12))
    draw = ImageDraw.Draw(canvas)
    font = ImageFont.load_default()
    draw.text((6, 4), title, fill=(230, 230, 230), font=font)
    for index, (image, label) in enumerate(rgb):
        x = index * cell_w
        canvas.paste(Image.fromarray(image, mode="RGB"), (x, label_h))
        draw.text((x + 4, label_h + cell_h + 4), label, fill=(220, 220, 220), font=font)
    canvas.save(path)


def _point_response_crop(
    image: np.ndarray,
    start: tuple[float, float],
    end: tuple[float, float],
    margin: int = 12,
) -> np.ndarray:
    xs = [start[0], end[0]]
    ys = [start[1], end[1]]
    x0 = max(int(np.floor(min(xs))) - margin, 0)
    y0 = max(int(np.floor(min(ys))) - margin, 0)
    x1 = min(int(np.ceil(max(xs))) + margin + 1, image.shape[1])
    y1 = min(int(np.ceil(max(ys))) + margin + 1, image.shape[0])
    return image[y0:y1, x0:x1]


def main() -> int:
    parser = argparse.ArgumentParser(description="01.11 exposure characterization")
    parser.add_argument("--image", type=Path, default=TUNING / "01.jpeg")
    parser.add_argument("--plan", type=Path, default=TUNING / "01.4-plan.json")
    parser.add_argument("--config", type=Path, default=CONFIG_PATH)
    parser.add_argument("--output-dir", type=Path, default=ANALYSIS)
    args = parser.parse_args()

    config = json.loads(args.config.read_text())
    crops = config["crops"]
    args.output_dir.mkdir(parents=True, exist_ok=True)
    crop_dir = args.output_dir / "crops"
    crop_dir.mkdir(parents=True, exist_ok=True)
    written: list[str] = []

    fixture, primitives = make_synthetic_fixture()
    syn_field = synthetic_motion_field()
    syn_path = exposure_path_length_pixels(
        syn_field, SYNTHETIC_STRENGTH, SYNTHETIC_SIZE, SYNTHETIC_SIZE
    )
    point_start, point_end, point_len = point_smear_segment(
        syn_field, SYNTHETIC_POINT_XY, SYNTHETIC_STRENGTH
    )

    source_path = args.output_dir / "01.11-synthetic-00-source.png"
    _save_image(source_path, fixture)
    written.append(str(source_path.relative_to(TUNING.parent.parent)))

    synthetic_results: dict[str, np.ndarray] = {"00_source": fixture}
    synthetic_energy: dict[str, dict[str, float]] = {"00_source": energy_stats(fixture)}
    point_metrics: dict[str, dict[str, float]] = {}
    profiles: dict[str, dict[str, list[float]]] = {}

    for name in OPERATOR_ORDER:
        exposed = apply_named_operator(name, fixture, syn_field, SYNTHETIC_STRENGTH, samples=16)
        synthetic_results[name] = exposed
        synthetic_energy[name] = energy_stats(exposed)
        filename = f"01.11-synthetic-{name.replace('_', '-')}.png"
        path = args.output_dir / filename
        _save_image(path, exposed)
        written.append(str(path.relative_to(TUNING.parent.parent)))

        distance, profile = sample_profile_along_segment(exposed, point_start, point_end)
        metrics = profile_metrics(distance, profile)
        point_metrics[name] = metrics
        profiles[name] = {"distance": distance.tolist(), "luminance": profile.tolist()}
        crop = _point_response_crop(exposed, point_start, point_end)
        crop_path = args.output_dir / f"01.11-synthetic-point-response-{name.replace('_', '-')}.png"
        _save_image(crop_path, crop)
        written.append(str(crop_path.relative_to(TUNING.parent.parent)))
        strip_path = args.output_dir / f"01.11-synthetic-point-profile-{name.replace('_', '-')}.png"
        Image.fromarray(_profile_strip(profile), mode="L").save(strip_path)
        written.append(str(strip_path.relative_to(TUNING.parent.parent)))

    source_distance, source_profile = sample_profile_along_segment(
        fixture, point_start, point_end
    )
    point_metrics["00_source"] = profile_metrics(source_distance, source_profile)
    sheet_tiles = [("source", fixture)] + [
        (OPERATORS[name]["label"], synthetic_results[name]) for name in OPERATOR_ORDER
    ]
    sheet_path = args.output_dir / "01.11-synthetic-contact-sheet.png"
    _contact_sheet(sheet_tiles, sheet_path, title="synthetic 256² exposure-only")
    written.append(str(sheet_path.relative_to(TUNING.parent.parent)))

    plan = load_plan(args.plan)
    gl_image = _load_image(args.image)
    height, width = gl_image.shape[:2]
    gl_field = forward_radial_motion_field(
        width,
        height,
        plan.camera.vanishing_point,
        plan.camera.forward,
    )
    gl_full_fixed = apply_multisample_exposure(
        gl_image, gl_field, GHOST_LIBRARY_STRENGTH, GHOST_LIBRARY_SAMPLES
    )
    gl_full_path = args.output_dir / "01.11-gl-01-fixed-16-box.png"
    _save_image(gl_full_path, gl_full_fixed)
    written.append(str(gl_full_path.relative_to(TUNING.parent.parent)))

    committed_strong = TUNING / "analysis" / "01.10" / "01.10-01-strong-exposure.png"
    gl_fixed_matches_01_10 = False
    if committed_strong.is_file():
        prior = _load_image(committed_strong)
        gl_fixed_matches_01_10 = bool(np.array_equal(gl_full_fixed, prior))

    gl_crop_energy: dict[str, dict[str, dict[str, float]]] = {}
    gl_operators_on_crops: dict[str, dict[str, np.ndarray]] = {
        name: {} for name in ["00_source", *OPERATOR_ORDER]
    }

    for crop_name, box in crops.items():
        gl_operators_on_crops["00_source"][crop_name] = extract_box(gl_image, box)
        padded = padded_crop_box(box, width, height, CROP_PAD_PIXELS)
        sub_image = extract_box(gl_image, padded)
        sub_field = extract_box(gl_field, padded)
        origin = (int(box["x"]) - int(padded["x"]), int(box["y"]) - int(padded["y"]))
        inner = {
            "x": origin[0],
            "y": origin[1],
            "width": int(box["width"]),
            "height": int(box["height"]),
        }
        gl_crop_energy[crop_name] = {"00_source": energy_stats(extract_box(gl_image, box))}
        for name in OPERATOR_ORDER:
            if name == "01_fixed_16_box":
                exposed_full_crop = extract_box(gl_full_fixed, box)
            else:
                exposed_pad = apply_named_operator(
                    name,
                    sub_image,
                    sub_field,
                    GHOST_LIBRARY_STRENGTH,
                    samples=GHOST_LIBRARY_SAMPLES,
                )
                exposed_full_crop = extract_box(exposed_pad, inner)
            gl_operators_on_crops[name][crop_name] = exposed_full_crop
            gl_crop_energy[crop_name][name] = energy_stats(exposed_full_crop)
            out = crop_dir / f"01.11-crop-{crop_name}-{name.replace('_', '-')}.png"
            _save_image(out, exposed_full_crop)
            written.append(str(out.relative_to(TUNING.parent.parent)))
        src_out = crop_dir / f"01.11-crop-{crop_name}-00-source.png"
        _save_image(src_out, extract_box(gl_image, box))
        written.append(str(src_out.relative_to(TUNING.parent.parent)))

        tiles = [("source", extract_box(gl_image, box))] + [
            (OPERATORS[name]["label"], gl_operators_on_crops[name][crop_name])
            for name in OPERATOR_ORDER
        ]
        crop_sheet = args.output_dir / f"01.11-contact-{crop_name}.png"
        _contact_sheet(tiles, crop_sheet, title=f"Ghost Library {crop_name}")
        written.append(str(crop_sheet.relative_to(TUNING.parent.parent)))

    profile_path = args.output_dir / "01.11-point-profiles.json"
    profile_path.write_text(json.dumps(profiles, indent=2) + "\n")
    written.append(str(profile_path.relative_to(TUNING.parent.parent)))

    analysis = {
        "experiment": "01.11-exposure-characterization",
        "not_a_new_renderer_version": True,
        "exposure_equation_from_code": {
            "gather": "dest[p] = (1/N) sum_i bilinear(source, p - v[p]*strength*t_i)",
            "t_i": "i / (N-1)",
            "field_to_pixels": "v_pixels = v_normalized * (width-1, height-1)",
            "01.8": "N=16 equal weights, outgoing sign -1",
            "01.9": "N=max(2, ceil(L)+1) per pixel, equal weights, same trajectory",
        },
        "synthetic": {
            "size": SYNTHETIC_SIZE,
            "vanishing_point": list(SYNTHETIC_VANISHING_POINT),
            "forward": SYNTHETIC_FORWARD,
            "strength": SYNTHETIC_STRENGTH,
            "point_xy": list(SYNTHETIC_POINT_XY),
            "point_path_length_pixels": point_len,
            "path_length_min": float(syn_path.min()),
            "path_length_max": float(syn_path.max()),
            "path_length_at_point": float(syn_path[SYNTHETIC_POINT_XY[1], SYNTHETIC_POINT_XY[0]]),
            "primitives": primitives,
            "energy": synthetic_energy,
            "point_response": point_metrics,
        },
        "operators": {
            name: {
                **OPERATORS[name],
                "normalization": (
                    "convex combination / weighted average"
                    if name != "04_forward_line"
                    else "forward deposit of source intensity along motion segment; energy approximately conserved per source pixel"
                ),
            }
            for name in OPERATOR_ORDER
        },
        "prefilter_sigma": PREFILTER_SIGMA,
        "ghost_library": {
            "strength": GHOST_LIBRARY_STRENGTH,
            "samples": GHOST_LIBRARY_SAMPLES,
            "vanishing_point": list(plan.camera.vanishing_point),
            "forward": float(plan.camera.forward),
            "full_fixed_16_matches_01_10_strong_exposure": gl_fixed_matches_01_10,
            "candidate_domain": "padded artifact crops, not full-resolution permutations",
            "crop_pad_pixels": CROP_PAD_PIXELS,
            "crop_energy": gl_crop_energy,
        },
        "artifacts": written,
        "classification": {
            "status": "pending_visual_inspection",
            "letters": None,
            "decision_answers": None,
            "hypothesis_for_01_12": None,
        },
    }
    analysis_path = TUNING / "analysis" / "01.11-exposure-characterization.json"
    analysis_path.write_text(json.dumps(analysis, indent=2) + "\n")
    print(f"Wrote {analysis_path}")
    print(f"synthetic point path length={point_len:.2f}")
    print(f"gl_fixed_matches_01_10={gl_fixed_matches_01_10}")
    for name in OPERATOR_ORDER:
        print(f"{name} point peaks={point_metrics[name]['peak_count']} p2v={point_metrics[name]['peak_to_valley']:.3f} energy_mean={synthetic_energy[name]['mean']:.3f}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
