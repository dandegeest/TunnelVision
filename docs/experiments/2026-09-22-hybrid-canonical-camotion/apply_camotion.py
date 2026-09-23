#!/usr/bin/env python3
"""Experiment-local: apply a stored canonical CameraMotionPlan to a rendered still.

Does not replan. Depth is estimated from the image being warped (application
weight, not a new motion plan). Production Camotion is not modified.
"""

from __future__ import annotations

import argparse
import json
import subprocess
import sys
from pathlib import Path

REPO = Path(__file__).resolve().parents[3]
PYTHON = REPO / "camotion/.venv/bin/python"
SRC = REPO / "camotion/src"


def run(args: list[str]) -> None:
    env = {**dict(**__import__("os").environ), "PYTHONPATH": str(SRC)}
    proc = subprocess.run(args, cwd=str(REPO / "camotion"), env=env)
    if proc.returncode != 0:
        raise SystemExit(proc.returncode)


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--image", required=True, type=Path)
    parser.add_argument("--plan", required=True, type=Path)
    parser.add_argument("--output", required=True, type=Path)
    parser.add_argument("--debug-dir", type=Path, default=None)
    args = parser.parse_args()
    args.output.parent.mkdir(parents=True, exist_ok=True)
    debug = args.debug_dir or args.output.parent / "camotion-debug"
    debug.mkdir(parents=True, exist_ok=True)
    depth = debug / "depth.png"
    run(
        [
            str(PYTHON),
            "-m",
            "camotion.estimate_depth",
            "--image",
            str(args.image.resolve()),
            "--output",
            str(depth),
        ]
    )
    cmd = [
        str(PYTHON),
        "-m",
        "camotion",
        "--image",
        str(args.image.resolve()),
        "--plan",
        str(args.plan.resolve()),
        "--output",
        str(args.output.resolve()),
        "--adaptive",
        "--depth",
        str(depth),
        "--debug-dir",
        str(debug),
    ]
    run(cmd)
    (debug / "apply.json").write_text(
        json.dumps(
            {
                "image": str(args.image),
                "plan": str(args.plan),
                "output": str(args.output),
                "depth": str(depth),
                "adaptive": True,
                "replanned": False,
                "note": "Plan is the stored canonical startPlan. Depth is from the image being warped.",
            },
            indent=2,
        )
        + "\n"
    )
    print(f"Wrote {args.output}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
