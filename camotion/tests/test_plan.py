"""Tests for CameraMotionPlan v1 validation."""

from __future__ import annotations

import json
from pathlib import Path

import pytest
from pydantic import ValidationError

from camotion.plan import CameraMotionPlan, load_plan

EXAMPLE = Path(__file__).resolve().parents[1] / "examples" / "camera-motion.json"


def _plan(**overrides: object) -> dict:
    data: dict = {
        "version": 1,
        "camera": {
            "vanishing_point": [0.52, 0.44],
            "forward": 0.8,
            "lateral": 0.0,
        },
        "destination": {
            "point": [0.55, 0.46],
            "protect": True,
            "bbox": [0.46, 0.32, 0.68, 0.82],
        },
        "exposure": {
            "strength": 0.75,
            "samples": 16,
        },
    }
    data.update(overrides)
    return data


def test_valid_example_file_round_trip() -> None:
    plan = load_plan(EXAMPLE)
    assert plan.version == 1
    assert plan.camera.vanishing_point == (0.52, 0.44)
    assert plan.camera.forward == 0.8
    assert plan.camera.lateral == 0.0
    assert plan.destination is not None
    assert plan.destination.point == (0.55, 0.46)
    assert plan.destination.protect is True
    assert plan.destination.bbox == (0.46, 0.32, 0.68, 0.82)
    assert plan.exposure.strength == 0.75
    assert plan.exposure.samples == 16


def test_valid_plan_without_destination() -> None:
    data = _plan()
    del data["destination"]
    plan = CameraMotionPlan.model_validate(data)
    assert plan.destination is None


def test_defaults_lateral_and_protect() -> None:
    data = _plan()
    del data["camera"]["lateral"]
    del data["destination"]["protect"]
    del data["destination"]["bbox"]
    plan = CameraMotionPlan.model_validate(data)
    assert plan.camera.lateral == 0.0
    assert plan.destination is not None
    assert plan.destination.protect is True
    assert plan.destination.bbox is None


def test_invalid_version_rejected() -> None:
    with pytest.raises(ValidationError):
        CameraMotionPlan.model_validate(_plan(version=2))
    with pytest.raises(ValidationError):
        CameraMotionPlan.model_validate(_plan(version=1.0))
    with pytest.raises(ValidationError):
        CameraMotionPlan.model_validate(_plan(version="1"))
    with pytest.raises(ValidationError):
        CameraMotionPlan.model_validate(_plan(version=True))
    data = _plan()
    del data["version"]
    with pytest.raises(ValidationError):
        CameraMotionPlan.model_validate(data)


def test_out_of_range_normalized_coordinates() -> None:
    data = _plan()
    data["camera"]["vanishing_point"] = [1.2, 0.5]
    with pytest.raises(ValidationError):
        CameraMotionPlan.model_validate(data)

    data = _plan()
    data["destination"]["point"] = [-0.01, 0.5]
    with pytest.raises(ValidationError):
        CameraMotionPlan.model_validate(data)

    data = _plan()
    data["camera"]["forward"] = 1.01
    with pytest.raises(ValidationError):
        CameraMotionPlan.model_validate(data)

    data = _plan()
    data["camera"]["lateral"] = -1.1
    with pytest.raises(ValidationError):
        CameraMotionPlan.model_validate(data)


def test_malformed_and_reversed_bbox() -> None:
    data = _plan()
    data["destination"]["bbox"] = [0.8, 0.32, 0.46, 0.82]
    with pytest.raises(ValidationError):
        CameraMotionPlan.model_validate(data)

    data = _plan()
    data["destination"]["bbox"] = [0.46, 0.9, 0.68, 0.2]
    with pytest.raises(ValidationError):
        CameraMotionPlan.model_validate(data)

    data = _plan()
    data["destination"]["bbox"] = [0.46, 0.32, 0.68]
    with pytest.raises(ValidationError):
        CameraMotionPlan.model_validate(data)

    data = _plan()
    data["destination"]["bbox"] = [0.46, 0.32, 0.68, 1.5]
    with pytest.raises(ValidationError):
        CameraMotionPlan.model_validate(data)

    data = _plan()
    data["destination"]["bbox"] = [0.5, 0.5, 0.5, 0.8]
    with pytest.raises(ValidationError):
        CameraMotionPlan.model_validate(data)


def test_invalid_exposure_samples() -> None:
    data = _plan()
    data["exposure"]["samples"] = 1
    with pytest.raises(ValidationError):
        CameraMotionPlan.model_validate(data)

    data = _plan()
    data["exposure"]["samples"] = 65
    with pytest.raises(ValidationError):
        CameraMotionPlan.model_validate(data)

    data = _plan()
    data["exposure"]["samples"] = 16.0
    with pytest.raises(ValidationError):
        CameraMotionPlan.model_validate(data)


def test_unknown_fields_are_ignored() -> None:
    data = _plan()
    data["depth"] = "not-a-v1-field"
    data["camera"]["roll"] = 0.2
    data["destination"]["masks"] = ["seg"]
    data["exposure"]["B_out"] = True
    plan = CameraMotionPlan.model_validate(data)
    dumped = plan.model_dump()
    assert "depth" not in dumped
    assert "roll" not in dumped["camera"]
    assert "masks" not in dumped["destination"]
    assert "B_out" not in dumped["exposure"]
    assert plan.camera.forward == 0.8


def test_integer_coordinates_accepted_as_numbers() -> None:
    data = _plan()
    data["camera"]["vanishing_point"] = [0, 1]
    data["camera"]["forward"] = 1
    plan = CameraMotionPlan.model_validate(data)
    assert plan.camera.vanishing_point == (0.0, 1.0)
    assert plan.camera.forward == 1.0


def test_load_plan_rejects_invalid_json(tmp_path: Path) -> None:
    path = tmp_path / "bad.json"
    path.write_text("{not json", encoding="utf-8")
    with pytest.raises(json.JSONDecodeError):
        load_plan(path)
