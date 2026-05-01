# Evaluation Notes

Use this file for concrete perceptual observations that should guide tuning.
Keep notes tied to a named corpus and the controls used during the pass.

## Canary Corpus

Date: 2026-04-30

Sources:

- `videoplayback (1).mp4`
- `videoplayback (2).mp4`
- `videoplayback.mp4`

Build:

- `min-duration-ms`: `50`
- `target-duration-ms`: `90`
- `max-duration-ms`: `160`
- units: `215`

Health:

- corpus health report passed with `0` issues and `0` warnings
- contact sheets show the correct canary/bird source material
- descriptor distributions are finite, normalized, and non-flat

Listening/viewing notes:

- `Audio / pitchHz (log raw)` against itself gives a broadly coherent pitch ordering.
- `Pitch Gate` around `0.86` improves pitch-focused auditioning.
- Pitch ordering is approximate rather than exact, which is expected for fast canary song syllables and trills.
- `Pitch Focus` and `Audio Focus` sound very similar with `Pitch Gate` around `0.86`, `Neighbor Jitter` at `0`, and `Continuity` at `0`.
- The similarity between Pitch Focus and Audio Focus is likely because this corpus is homogeneous birdsong, so pitch-related descriptors dominate the useful audio variation.
- `Video Focus` with `motionMagnitude` against `motionMagnitude` behaves like a coherent low-to-high motion scale.
- `motionMagnitude` against `frameDiffEnergy` shows a related but messier trajectory, as expected.
- A small number of video outliers appear to be camera shake rather than descriptor extraction failures.

Interpretation:

- Treat this as a useful audio/pitch regression corpus and a basic video descriptor sanity corpus.
- Do not treat it as the only AV-motion evaluation corpus because the birds are mostly stationary while singing.
- Add a second small corpus with obvious visual motion before tuning video-driven retrieval behavior.
