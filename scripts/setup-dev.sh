#!/usr/bin/env bash
# Bootstrap TunnelVision Node + Camotion deps from a clean clone.
# Does not write secrets. Copies .env.example → .env.local if missing.
set -euo pipefail

root="$(CDPATH= cd -- "$(dirname "$0")/.." && pwd)"
cd "$root"

need() {
  if ! command -v "$1" >/dev/null 2>&1; then
    echo "error: $1 is not on PATH" >&2
    exit 1
  fi
}

version_ge() {
  # version_ge 3.11.0 3.11
  awk -v have="$1" -v want="$2" 'BEGIN {
    n = split(have, h, ".")
    m = split(want, w, ".")
    for (i = 1; i <= m; i++) {
      hv = (i <= n) ? h[i] + 0 : 0
      wv = w[i] + 0
      if (hv > wv) exit 0
      if (hv < wv) exit 1
    }
    exit 0
  }'
}

need node
need npm
need python3
need ffmpeg
need ffprobe

node_ver="$(node -p "process.versions.node")"
if ! version_ge "$node_ver" "20"; then
  echo "error: Node >= 20 required (found $node_ver)" >&2
  exit 1
fi

py_ver="$(python3 -c 'import sys; print("%d.%d.%d" % sys.version_info[:3])')"
if ! version_ge "$py_ver" "3.11"; then
  echo "error: Python >= 3.11 required (found $py_ver). Do not use an old Xcode python3." >&2
  exit 1
fi

echo "Node $node_ver"
echo "Python $py_ver"
echo "Installing media/ and web/ with npm ci…"
npm --prefix media ci
npm --prefix web ci

echo "Creating camotion/.venv (required at camotion/.venv/bin/python)…"
python3 -m venv camotion/.venv
camotion/.venv/bin/python -m pip install -U pip
(
  cd camotion
  .venv/bin/pip install -e ".[dev]"
  if [ "${SKIP_CAMOTION_DEPTH:-}" != "1" ]; then
    echo "Installing optional Camotion depth extra (torch / transformers)…"
    .venv/bin/pip install -e ".[depth]"
  else
    echo "Skipping Camotion depth extra (SKIP_CAMOTION_DEPTH=1)."
  fi
)

if [ ! -f .env.local ]; then
  cp .env.example .env.local
  echo "Wrote .env.local from .env.example — add REPLICATE_API_TOKEN before live generation."
else
  echo ".env.local already exists; leaving it unchanged."
fi

echo
echo "Next:"
echo "  npm --prefix media run config:check"
echo "  npm --prefix web run dev -- --host 127.0.0.1 --port 5173"
echo "See FRESH_MACHINE_SETUP.md"
