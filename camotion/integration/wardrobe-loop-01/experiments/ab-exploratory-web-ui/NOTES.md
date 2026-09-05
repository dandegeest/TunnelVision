# Exploratory Replicate web UI A→B tests

**Not controlled.** Different seeds. Different aspect-ratio setting from the
later automated 2×2 (`16:9` in the Replicate web UI vs `adaptive` in the
provider/API path). One run generated audio. These motivated the controlled
experiment; they are not part of it.

Original Downloads filenames are recorded below. The copies here use
filesystem-safe names. Informal Downloads labels used `nomotion`; that
does **not** mean the prompt requested a locked-off camera. The prompt was
the minimal journey sentence, which can itself induce camera motion.

The manual locomotion prompt in run 3 is **not** the Integration Test 01
A→B Seedance prompt. The authoritative IT01 prompt lives in
`generation-manifest.json` `shots["A-B"].video.prompt`.

| Copy | Original Downloads name | Endpoints | Prompt class | Seed | Audio | Prediction |
| --- | --- | --- | --- | --- | --- | --- |
| `A-B-nomotion-seed50.mp4` | `A-B nomotion.mp4` | pristine A/B | minimal journey | 50 | true | `pzvvne7bc1rmt0d0ebdarwwx28` |
| `Ap-Bp-nomotion-seed40.mp4` | `A'-B' nomotion.mp4` | Camotion A′/B′ | minimal journey | 40 | false | `fh8t4h3r7xrmy0d0ebetfpn6am` |
| `A-B-manual-motion-seed60.mp4` | `A-B motion.mp4` | pristine A/B | **manual** locomotion (not IT01) | 60 | false | `ey3nfwjrqdrmt0d0ebssagmr2c` |

Shared web-UI settings (as recorded): Seedance 2.5, duration 6, resolution
720p, aspect_ratio 16:9, watermark false, output_format mp4.

## Prompts

Minimal journey (runs 1 and 2):

> A continuous journey from a cozy attic bedroom, through the old wardrobe, and into the snowy winter world beyond.

Manual locomotion (run 3 only; **not** Integration Test 01):

> First-person camera walks steadily forward through the environment, physically traveling from the starting location to the ending location. The camera moves forward through the wardrobe, passes completely through the opening into the snowy world beyond, and continues moving forward as the shot ends.

## Qualitative notes (exploratory)

1. Pristine + minimal (seed 50): forward motion occurred; transition felt
   like a cut/crossfade/dissolve; the shot eased/resolved toward the endpoint.
2. Conditioned + minimal (seed 40): forward motion; somewhat less cut-like
   than pristine/minimal, but still read as a cut/stop rather than fully
   continuous traversal; easing remained apparent.
3. Pristine + manual locomotion (seed 60): forward motion; world transition
   still felt like a cut/dissolve.

## Hashes

| File | Bytes | SHA-256 |
| --- | --- | --- |
| `A-B-nomotion-seed50.mp4` | 7275640 | `861305557ad4effcaf2337ef60eb562e9baf9c58b594fe0fa67ae7ff9ba83796` |
| `Ap-Bp-nomotion-seed40.mp4` | 7587058 | `da772e1de2e94483065c59d2f71a8931153554879b723d906b1a20b8d50a6868` |
| `A-B-manual-motion-seed60.mp4` | 7238801 | `ab2a24fa15148119d04993e5a63282860a756875bfd0e054baafc24157316943` |
