"""CLI render behavior."""

from __future__ import annotations

from pathlib import Path

import pytest
from PIL import Image

from camotion.__main__ import main

EXAMPLE = Path(__file__).resolve().parents[1] / "examples" / "camera-motion.json"


def test_cli_renders_example_plan(tmp_path: Path, capsys: pytest.CaptureFixture[str]) -> None:
    image = tmp_path / "input.png"
    Image.new("RGB", (16, 10), color=(12, 34, 56)).save(image)
    output = tmp_path / "output.png"

    code = main(
        [
            "--image",
            str(image),
            "--plan",
            str(EXAMPLE),
            "--output",
            str(output),
        ]
    )
    captured = capsys.readouterr()
    assert code == 0
    assert str(output) in captured.out
    assert "not implemented" not in captured.out
    assert output.exists()

    with Image.open(output) as written:
        assert written.size == (16, 10)
        assert written.mode == "RGB"


def test_cli_missing_image(tmp_path: Path, capsys: pytest.CaptureFixture[str]) -> None:
    code = main(
        [
            "--image",
            str(tmp_path / "missing.png"),
            "--plan",
            str(EXAMPLE),
            "--output",
            str(tmp_path / "out.png"),
        ]
    )
    captured = capsys.readouterr()
    assert code == 1
    assert "image not found" in captured.err
    assert not (tmp_path / "out.png").exists()


def test_cli_missing_plan(tmp_path: Path, capsys: pytest.CaptureFixture[str]) -> None:
    image = tmp_path / "input.png"
    Image.new("RGB", (8, 8), color=(0, 0, 0)).save(image)

    code = main(
        [
            "--image",
            str(image),
            "--plan",
            str(tmp_path / "missing.json"),
            "--output",
            str(tmp_path / "out.png"),
        ]
    )
    captured = capsys.readouterr()
    assert code == 1
    assert "plan not found" in captured.err
    assert not (tmp_path / "out.png").exists()


def test_cli_invalid_plan(tmp_path: Path, capsys: pytest.CaptureFixture[str]) -> None:
    image = tmp_path / "input.png"
    Image.new("RGB", (8, 8), color=(0, 0, 0)).save(image)
    plan = tmp_path / "bad.json"
    plan.write_text('{"version": 2}', encoding="utf-8")

    code = main(
        [
            "--image",
            str(image),
            "--plan",
            str(plan),
            "--output",
            str(tmp_path / "out.png"),
        ]
    )
    captured = capsys.readouterr()
    assert code == 1
    assert "invalid CameraMotionPlan" in captured.err
    assert not (tmp_path / "out.png").exists()
