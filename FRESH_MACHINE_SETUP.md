# Fresh-machine setup

Reconstruct a working TunnelVision development environment from a Git
clone plus separately stored credentials. This file is the bootstrap
path. Product architecture lives in `docs/`.

Audited against the repo on 14 September 2026. There is **no**
root `package.json`. Install **both** Node packages. Camotion is a
**separate Python package** whose product CLI **must** live at
`camotion/.venv/bin/python` (hard-coded in `web/camotion-cli.ts`).

## Verdict

**MOSTLY READY.** Unit tests, the Vite app, Camotion rendering, and a
live Plan | Shoot loop can be rebuilt from git. Depth-weighted Camotion
and paid generation need extra installs and a Replicate token that are
not in the repo.

## What you need

| Tool | Requirement | Notes |
| --- | --- | --- |
| macOS | Apple Silicon | Tested on darwin arm64 |
| Git | any recent | No Git LFS. Research videos are ordinary git blobs |
| Node | **≥ 20**, **22 recommended** | `.nvmrc` is `22`. This machine ran `v22.17.1` |
| npm | comes with Node | Use `npm ci` (lockfiles exist). Not pnpm/yarn |
| Python | **≥ 3.11** | `camotion/pyproject.toml`. Do **not** use an old Xcode `python3` |
| ffmpeg + ffprobe | on `PATH` | Product Export Movie and `web` concat tests |
| Replicate token | `REPLICATE_API_TOKEN` | Live Director / CM / stills / video |
| Hugging Face download | first depth estimate | Optional; public `Depth-Anything-V2-Small-hf` |

Homebrew is the practical way to get Node, Python 3.11+, and ffmpeg.

## Exact bootstrap

```bash
# 1. Prerequisites (once per Mac)
xcode-select --install   # if prompted; native addons / some Python builds
brew install git node@22 python@3.13 ffmpeg
# or: nvm install   # respects .nvmrc
node -v                  # >= 20
python3 --version        # >= 3.11
ffmpeg -version
ffprobe -version

# 2. Clone
git clone https://github.com/dandegeest/TunnelVision.git
cd TunnelVision

# 3. Node packages (both; Vite plugins import media/ TypeScript)
npm --prefix media ci
npm --prefix web ci

# 4. Camotion venv at the path the product actually calls
python3 -m venv camotion/.venv
camotion/.venv/bin/python -m pip install -U pip
camotion/.venv/bin/pip install -e "camotion/[dev]"

# 5. Optional: depth estimator (otherwise Camotion still runs, without --depth)
camotion/.venv/bin/pip install -e "camotion/[depth]"

# 6. Credentials (never commit)
cp .env.example .env.local
# paste REPLICATE_API_TOKEN from 1Password / Replicate dashboard

# 7. Optional Playwright browsers (e2e only)
cd web && npx playwright install chromium && cd ..

# 8. Or run the same steps via:
#    ./scripts/setup-dev.sh
```

`scripts/setup-dev.sh` does steps 3–5 (and copies `.env.example` to
`.env.local` if missing). It does not invent a token.

## Run

```bash
# Config presence (does not call Replicate)
npm --prefix media run config:check

# App: http://127.0.0.1:5173
npm --prefix web run dev -- --host 127.0.0.1 --port 5173
```

No other long-running Python service. Vite dev plugins in `web/` call
Director, destination construct, CM, Camotion, shoot, runtime media,
and export on demand. Session stills live under a temp directory, not
git.

There is **no** Runway MCP (or any project MCP) in this repo. Current
product generation is Replicate. Hackathon Runway adapters are not
implemented yet; when they are, add `RUNWAYML_API_SECRET` to
`.env.local` (names are reserved in `.env.example`).

## Test

```bash
npm --prefix media test
cd camotion && .venv/bin/python -m pytest && cd ..
npm --prefix web test          # needs ffmpeg on PATH (export concat)
npm --prefix web run e2e       # mocks providers; needs Playwright Chromium
```

`web` Camotion tests skip the live CLI unless `camotion/.venv/bin/python`
exists. After step 4 they should run it.

## Representative live loop (paid)

1. `npm --prefix media run config:check` shows `REPLICATE_API_TOKEN: configured`.
2. `npm --prefix web run dev` and open `http://127.0.0.1:5173`.
3. New untitled project. Upload or generate opening A.
4. CREATE JOURNEY (Director on Replicate Gemini 3.1 Pro).
5. Construct B (Nano Banana 2 Lite by default).
6. Wait for automatic Motion Planning: CM JSON → CameraMotionPlan →
   Camotion A′/B′ via `camotion/.venv/bin/python -m camotion`.
7. SHOOT (Pruna by default; Seedance 2.5 from Project settings).
8. Optional Export Movie (ffmpeg concat).

If the venv is missing, SHOOT/MOTION fails with
`Camotion Python is not available at …/camotion/.venv/bin/python`.
If `[depth]` is not installed, Camotion still renders; dest/VP weights
run without a near-weight map. The first successful depth estimate
downloads `depth-anything/Depth-Anything-V2-Small-hf` into
`~/.cache/huggingface/` (network; no token required for that public
model).

## Cursor

Project rule `.cursor/rules/desktop-patch.mdc` is tracked. After clone,
Cursor should pick it up. It writes working-tree patches to
`~/Desktop/tunnelvision-pr-N.N.patch`.

Do **not** copy `~/.cursor/` product MCP servers (`cursor-ide-browser`,
etc.). They are the editor, not TunnelVision.

`docs/AGENTS.md` is filmmaking-role guidance and is already in git.

## Gitignored local state (do not commit)

| Path | Recreate? |
| --- | --- |
| `.env.local` | Copy token from a password manager |
| `camotion/.venv/` | Recreate with setup above |
| `node_modules/` | `npm ci` |
| `~/.cache/huggingface/` | Re-downloads on first depth run |
| `web/dist/`, `media/dist/` | build outputs |
| Playwright report/cache | regenerate |
| OS temp `tunnelvision-camotion-*` | ephemeral Camotion work dirs |

Research fixtures (Forest A→F, Wardrobe Loop stills and videos) **are
in git** under `camotion/integration/`. The product starts from a new
project, not those journeys; they are tests and Debug fixtures.

## Credentials to store off-machine

1. **Replicate API token** (this is the one required secret today).
2. Replicate account that can run `google/gemini-3.1-pro`,
   `google/nano-banana-2-lite` / `google/nano-banana-2`, and the
   Project video models (`prunaai/p-video`, Kling, Wan, Seedance).
3. GitHub access to this repo.
4. Later: Runway `RUNWAYML_API_SECRET` and Model Router config IDs
   (`docs/HACKATHON.md`). Not required to run the current app.
5. Optional: Hugging Face token only if you hit gated-model errors
   (the current depth model is public).
