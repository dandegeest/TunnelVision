# Controlled A→B Seedance 2×2 (seed 70)

Not Camotion 01.13. No Camotion retune. Existing Integration Test 01
A/B and A′/B′ files were reused. Sequential paid Seedance 2.5 jobs.
Zero retries. All four succeeded.

This is **not** the original unseeded Integration Test 01 A→B
(`videos/A-B.mp4`). It is **not** the exploratory web-UI runs in
`../ab-exploratory-web-ui/`.

Harness: `media/experiments/wardrobe-loop/ab-2x2.ts`
Machine record: `manifest.json`

## Independent variables

1. Endpoints: pristine A/B vs Camotion-conditioned A′/B′
2. Prompt: minimal journey vs authoritative Integration Test 01 A→B
   Cinematographer locomotion prompt

`COMMON_VIDEO_INTENT` was not prepended. The motion prompt is exactly
`shots["A-B"].video.prompt` / `VIDEO_PROMPTS["A-B"]`.

## Shared settings

model `bytedance/seedance-2.5`, duration 6, resolution 720p,
aspect_ratio `adaptive`, generate_audio false, watermark false,
output_format mp4, seed 70 (submitted and reported on every prediction).

## Results

| ID | Endpoints | Prompt | Prediction | Seed | File | SHA-256 |
| --- | --- | --- | --- | --- | --- | --- |
| 01-pristine-minimal | A/B | minimal | `g4ygbpr4qsrmy0d0ec891myw64` | 70 | `01-pristine-minimal.mp4` | `ca595e99799f76557c3e5091f0619abcd8efb6f65e5e520838b5d6e5f27c5676` |
| 02-pristine-motion | A/B | IT01 locomotion | `50m7gg6nfdrmt0d0ecbrc8j618` | 70 | `02-pristine-motion.mp4` | `45e51c71338291c62464e6bc45c2b1b55a155d572c3d84d6695c4bad1ec62a19` |
| 03-conditioned-minimal | A′/B′ | minimal | `d2151cn9tsrmw0d0ecfadxnew8` | 70 | `03-conditioned-minimal.mp4` | `847c283cfec4caf8f28acda28231c99215c058e6cc201ca5ea2d77cc7b84a498` |
| 04-conditioned-motion | A′/B′ | IT01 locomotion | `8kwb28tayhrmr0d0ecnaca4nzr` | 70 | `04-conditioned-motion.mp4` | `b178ebf95ce0cba14bbd2414d21cf5a3e3ee900fdf199819a2099b7ccfbfecee` |

## Human evaluation

Independent reviewer judgment: **04-conditioned-motion is the clear
winner.** One controlled seed. Not statistical proof across seeds.

At seed 70, Camotion-conditioned endpoints **and** the authoritative
Cinematographer locomotion prompt produced the strongest spatial and
temporal continuity of the four. Neither pristine+locomotion nor
conditioned+minimal matched the combination.

Working interpretation: Cinematographer prompt supplies semantic /
physical locomotion intent; Camotion supplies visual motion-state
conditioning; Seedance combines the two.

Condition 04 was judged not merely equivalent to the original
unseeded Integration Test 01 A→B hero shot: the wardrobe/clothes →
snowy forest transition was judged **even better**, reading as
bedroom → wardrobe threshold → hanging clothes passing the camera →
dark intermediate passage → snowy world. No intermediate canonical
was supplied. Seedance inferred useful intermediate volume from
conditioned endpoints, scene geometry, and detailed route language.

## Informal / crude frame-change observation

A crude exploratory frame-to-frame visual-change check performed
**outside this repo** suggested increasing final-half-second activity
in this order:

- 01 pristine + minimal: ~0.96
- 02 pristine + motion: ~3.47
- 03 conditioned + minimal: ~4.32
- 04 conditioned + motion: ~5.33

These numbers are **not camera velocity**. They can include snow,
morphing, exposure change, and other pixel activity. Not a validated
metric. Recorded only as an informal observation aligned with the
human ranking.
