#!/usr/bin/env python3
"""Decode a clip, save first/last frames and a near-end window. No production I/O."""

from __future__ import annotations

import json
import subprocess
import sys
from pathlib import Path

import numpy as np
from PIL import Image

WINDOW = 8


def probe(path: Path) -> dict:
    payload = json.loads(
        subprocess.check_output(
            [
                "ffprobe",
                "-v",
                "error",
                "-print_format",
                "json",
                "-show_format",
                "-show_streams",
                "-select_streams",
                "v:0",
                str(path),
            ],
            text=True,
        )
    )
    stream = next(s for s in payload["streams"] if s["codec_type"] == "video")
    return {
        "width": int(stream["width"]),
        "height": int(stream["height"]),
        "codec": stream.get("codec_name"),
        "pix_fmt": stream.get("pix_fmt"),
        "fps": stream.get("r_frame_rate"),
        "duration": float(payload["format"]["duration"]),
    }


def decode(path: Path, width: int, height: int) -> np.ndarray:
    frame_bytes = width * height * 3
    proc = subprocess.Popen(
        [
            "ffmpeg",
            "-hide_banner",
            "-loglevel",
            "error",
            "-i",
            str(path),
            "-f",
            "rawvideo",
            "-pix_fmt",
            "rgb24",
            "pipe:1",
        ],
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
    )
    raw, err = proc.communicate()
    if proc.returncode != 0:
        raise RuntimeError(err.decode())
    count = len(raw) // frame_bytes
    return np.frombuffer(raw, dtype=np.uint8).reshape((count, height, width, 3)).copy()


def sharpness(frame: np.ndarray) -> float:
    gray = frame.astype(np.float64).mean(axis=2)
    return float(
        np.mean(
            np.abs(
                gray[1:-1, 1:-1] * 4
                - gray[:-2, 1:-1]
                - gray[2:, 1:-1]
                - gray[1:-1, :-2]
                - gray[1:-1, 2:]
            )
        )
    )


def main() -> int:
    video = Path(sys.argv[1])
    dest = Path(sys.argv[2])
    dest.mkdir(parents=True, exist_ok=True)
    info = probe(video)
    frames = decode(video, info["width"], info["height"])
    last = int(frames.shape[0] - 1)
    Image.fromarray(frames[0]).save(dest / "first.png")
    Image.fromarray(frames[-1]).save(dest / "last_literal.png")
    tail = dest / "tail"
    tail.mkdir(exist_ok=True)
    window = list(range(max(0, last - WINDOW + 1), last + 1))
    rows = []
    prev = None
    for idx in window:
        Image.fromarray(frames[idx]).save(tail / f"frame-{idx:04d}.png")
        mae = None
        if prev is not None:
            mae = float(np.mean(np.abs(frames[idx].astype(np.float64) - prev.astype(np.float64))))
        luma = float(frames[idx].astype(np.float64).mean())
        rows.append(
            {
                "index": idx,
                "vs_prev_mae": mae,
                "luma": luma,
                "sharpness": sharpness(frames[idx]),
            }
        )
        prev = frames[idx]
    record = {
        **info,
        "decoded_frames": int(frames.shape[0]),
        "last_index": last,
        "window": rows,
        "selected": {
            "index": last,
            "reason": "literal last decoded frame; window inspected for glitch only",
        },
    }
    (dest / "extract.json").write_text(json.dumps(record, indent=2) + "\n")
    print(json.dumps(record, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
