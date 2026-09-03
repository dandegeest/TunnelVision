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

The official Replicate JS SDK auto-uploads `Blob`, `File`, or `Buffer`.
Local files are read as bytes. Node `ReadStream`s are not uploaded and
produce HTTP 422 (`Expected: string, given: object`).

Successful 01.5 smoke-test evidence lives at
`camotion/tuning/video-runs/replicate-bytedance-seedance-2.5/01.5/`.
Do not overwrite historical Krea videos. `observed_cost_usd` on a run
record is optional operator-recorded metadata, not API-reported pricing.
