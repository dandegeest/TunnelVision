"""Artifact checks for Camotion integration test 01 (wardrobe loop).

Skips when the generated integration directory is not present yet.
"""

from __future__ import annotations

import hashlib
import json
import re
from pathlib import Path

import pytest
from PIL import Image

from camotion.plan import load_plan

ROOT = Path(__file__).resolve().parents[1] / "integration" / "wardrobe-loop-01"
CANONICALS = ("A", "B", "C", "D", "E")
SHOTS = ("A-B", "B-C", "C-D", "D-E", "E-A")
SECRET_MARKERS = ("REPLICATE_API_TOKEN",)


def _require_root() -> Path:
    if not ROOT.is_dir():
        pytest.skip("wardrobe-loop-01 artifacts not generated")
    return ROOT


def _sha256(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def test_canonicals_are_16x9_pngs() -> None:
    root = _require_root()
    for name in CANONICALS:
        path = root / "canonical" / f"{name}.png"
        if not path.is_file():
            pytest.skip(f"missing {path}")
        with Image.open(path) as image:
            width, height = image.size
        assert width / height == pytest.approx(16 / 9, abs=0.02)


def test_f_is_exactly_a() -> None:
    root = _require_root()
    a = root / "canonical" / "A.png"
    f = root / "canonical" / "F.png"
    if not a.is_file() or not f.is_file():
        pytest.skip("canonical A/F not generated")
    assert _sha256(a) == _sha256(f)
    assert a.read_bytes() == f.read_bytes()


def test_camera_motion_plans_validate() -> None:
    root = _require_root()
    for shot in SHOTS:
        path = root / "plans" / f"{shot}.json"
        if not path.is_file():
            pytest.skip(f"missing {path}")
        plan = load_plan(path)
        assert plan.version == 1
        dumped = json.loads(path.read_text(encoding="utf-8"))
        assert set(dumped) <= {"version", "camera", "destination", "exposure"}


def test_shooting_frames_and_videos_exist() -> None:
    root = _require_root()
    for shot in SHOTS:
        start = root / "shooting" / shot / "start.png"
        end = root / "shooting" / shot / "end.png"
        video = root / "videos" / f"{shot}.mp4"
        if not start.is_file() or not end.is_file() or not video.is_file():
            pytest.skip(f"incomplete shot {shot}")
        assert start.stat().st_size > 0
        assert end.stat().st_size > 0
        assert video.stat().st_size > 1000


def test_manifest_hashes_resolve_and_contains_no_secrets() -> None:
    root = _require_root()
    repo = Path(__file__).resolve().parents[2]
    manifest_path = root / "generation-manifest.json"
    if not manifest_path.is_file():
        pytest.skip("generation-manifest.json not written")
    text = manifest_path.read_text(encoding="utf-8")
    for marker in SECRET_MARKERS:
        assert marker not in text
    assert re.search(r"r8_[A-Za-z0-9]{8,}", text) is None
    manifest = json.loads(text)
    assert manifest["f_equals_a"] is True
    for name in CANONICALS:
        record = manifest["canonicals"][name]
        path = repo / record["output_path"]
        assert path.is_file()
        assert _sha256(path) == record["sha256"]
    for shot in SHOTS:
        record = manifest["shots"][shot]
        video = record["video"]
        video_path = repo / video["output_path"]
        assert video_path.is_file()
        assert _sha256(video_path) == video["sha256"]
    assembled = manifest["assembled_movie"]
    original = repo / assembled["original"]["path"]
    browser = repo / assembled["browser"]["path"]
    assert original.is_file()
    assert browser.is_file()
    assert original.suffix.lower() == ".mov"
    assert browser.suffix.lower() == ".mp4"
    assert _sha256(original) == assembled["original"]["sha256"]
    assert _sha256(browser) == assembled["browser"]["sha256"]
