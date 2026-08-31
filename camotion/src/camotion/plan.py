"""CameraMotionPlan v1: Pydantic models matching docs/DATA_MODEL.md."""

from __future__ import annotations

import json
from pathlib import Path
from typing import Annotated, Any

from pydantic import BaseModel, ConfigDict, Field, StrictInt, field_validator

_MIN = 0.0
_MAX = 1.0


def _as_float(value: Any, *, name: str) -> float:
    if isinstance(value, bool) or not isinstance(value, (int, float)):
        raise ValueError(f"{name} must be a number")
    return float(value)


def _require_in_unit_interval(value: float, *, name: str) -> float:
    if not (_MIN <= value <= _MAX):
        raise ValueError(f"{name} must be in [0, 1], got {value}")
    return value


def parse_normalized_point(value: Any) -> tuple[float, float]:
    if not isinstance(value, (list, tuple)) or len(value) != 2:
        raise ValueError("point must be [x, y]")
    x = _require_in_unit_interval(_as_float(value[0], name="x"), name="x")
    y = _require_in_unit_interval(_as_float(value[1], name="y"), name="y")
    return (x, y)


def parse_normalized_bbox(value: Any) -> tuple[float, float, float, float]:
    if not isinstance(value, (list, tuple)) or len(value) != 4:
        raise ValueError("bbox must be [left, top, right, bottom]")
    left = _require_in_unit_interval(_as_float(value[0], name="left"), name="left")
    top = _require_in_unit_interval(_as_float(value[1], name="top"), name="top")
    right = _require_in_unit_interval(_as_float(value[2], name="right"), name="right")
    bottom = _require_in_unit_interval(_as_float(value[3], name="bottom"), name="bottom")
    if not (left < right):
        raise ValueError("bbox left must be < right")
    if not (top < bottom):
        raise ValueError("bbox top must be < bottom")
    return (left, top, right, bottom)


NormalizedPoint = Annotated[tuple[float, float], Field(min_length=2, max_length=2)]
NormalizedBBox = Annotated[
    tuple[float, float, float, float], Field(min_length=4, max_length=4)
]


class Camera(BaseModel):
    model_config = ConfigDict(extra="ignore")

    vanishing_point: NormalizedPoint
    forward: float = Field(ge=_MIN, le=_MAX)

    @field_validator("vanishing_point", mode="before")
    @classmethod
    def _vanishing_point(cls, value: Any) -> tuple[float, float]:
        return parse_normalized_point(value)


class Destination(BaseModel):
    model_config = ConfigDict(extra="ignore")

    point: NormalizedPoint
    protect: bool = True
    bbox: NormalizedBBox | None = None

    @field_validator("point", mode="before")
    @classmethod
    def _point(cls, value: Any) -> tuple[float, float]:
        return parse_normalized_point(value)

    @field_validator("bbox", mode="before")
    @classmethod
    def _bbox(cls, value: Any) -> tuple[float, float, float, float] | None:
        if value is None:
            return None
        return parse_normalized_bbox(value)


class Exposure(BaseModel):
    model_config = ConfigDict(extra="ignore")

    strength: float = Field(ge=_MIN, le=_MAX)
    samples: StrictInt = Field(ge=2, le=64)


class CameraMotionPlan(BaseModel):
    """Frozen CameraMotionPlan v1 contract. Unknown keys are ignored."""

    model_config = ConfigDict(extra="ignore")

    version: int
    camera: Camera
    exposure: Exposure
    destination: Destination | None = None

    @field_validator("version", mode="before")
    @classmethod
    def _version_is_integer_one(cls, value: Any) -> int:
        if isinstance(value, bool) or type(value) is not int:
            raise ValueError("version must be the integer 1")
        if value != 1:
            raise ValueError("version must be 1")
        return value


def load_plan(path: Path | str) -> CameraMotionPlan:
    """Load and validate a CameraMotionPlan JSON file."""
    plan_path = Path(path)
    data = json.loads(plan_path.read_text(encoding="utf-8"))
    return CameraMotionPlan.model_validate(data)
