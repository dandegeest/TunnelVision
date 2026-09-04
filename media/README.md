# TunnelVision media generation

Product-facing `MediaProvider` contract and the first Replicate adapter.

Camotion remains a standalone Python renderer and is not imported here.

``` text
TunnelVision application / research runner
        |
  MediaProvider
        |
ReplicateMediaProvider
        |
 Seedance 2.5 adapter
        |
   Replicate API
```

## Credentials

Application code reads credentials from environment variables. It does
not care whether those variables came from a local file or a deployment
platform.

| Environment | How variables are supplied |
| --- | --- |
| Local development | repo-root `.env.local` (gitignored) |
| CI / deployment | environment or secret-manager injection |
| Tracked template | repo-root `.env.example` (names only) |

Current variable: `REPLICATE_API_TOKEN`

Shell and deployment environment win. `.env.local` only fills keys that
are not already set. Provider classes do not parse env files.

``` bash
npm --prefix media run config:check
npm --prefix media test
npm --prefix media run experiment -- --manifest media/experiments/manifests/01.5.json
```

`--execute` is required for a paid Replicate call. Dry-run is the default.

Prompt-control experiments are not Camotion 01.x IDs. The first camera-speed
manifest holds 01.8 A′/B′ constant and changes only requested velocity:

``` bash
npm --prefix media run experiment -- --manifest media/experiments/manifests/prompt-control/camera-speed/seedance-slow.json
npm --prefix media run experiment -- --manifest media/experiments/manifests/prompt-control/camera-speed/seedance-slow-embodied.json
```

Evidence for that family is stored under
`camotion/tuning/video-runs/prompt-control/camera-speed/`, not beside the
01.3–01.8 Camotion series. `seedance-slow-embodied` holds the
seedance-slow frames, settings, and slow-speed phrase constant and adds
only embodied walking camera language. Both Seedance prompt-control
runs now have evidence under that family. Do not overwrite historical
Krea or 01.x Replicate videos. Unvalidated product ideas from these
runs are in `docs/RESEARCH_BACKLOG.md`.

Historical Camotion reruns use a thin batch command above MediaProvider:

``` bash
npm --prefix media run benchmark -- --experiments 01.3,01.4,01.6,01.7,01.8
```

That command is dry-run by default. `--execute` is required for paid
calls. Successful existing runs are skipped unless `--rerun-existing`
is passed. Failures stop the batch. Do not overwrite historical Krea
videos.

The official Replicate JS SDK auto-uploads `Blob`, `File`, or `Buffer`.
Local files are read as bytes. Node `ReadStream`s are not uploaded and
produce HTTP 422 (`Expected: string, given: object`).

Successful 01.5 smoke-test evidence lives at
`camotion/tuning/video-runs/replicate-bytedance-seedance-2.5/01.5/`
(`01.5-result.mp4`, `01.5-run.json`). Run records and videos are named
`<experiment>/<experiment>-run.json` and
`<experiment>/<experiment>-result.mp4`. Do not overwrite historical
Krea videos. `observed_cost_usd` on a run record is optional evidence
metadata. `observed_cost_source` must be `"manual"` for
operator-observed cost or `"provider"` if an API later returns a
price. Batch cost estimates read the successful 01.5 control run
record (`01.5-run.json`); they do not hardcode a price. If that
evidence has no manual cost, the dollar estimate is omitted.
