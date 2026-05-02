# Evaluation Notes

Use this file for concrete perceptual observations that should guide tuning.
Keep notes tied to a named corpus and the controls used during the pass.

## Web Demo Corpus

Date: 2026-05-02

Sources:

- `nixon-not-a-crook.mp4`

Build:

- `min-duration-ms`: `50`
- `target-duration-ms`: `90`
- `max-duration-ms`: `160`
- units: `293`

Health:

- corpus health report passed with `0` issues and `0` warnings
- contact sheets show the expected source material
- descriptor distributions are finite, normalized, and non-flat

Listening/viewing notes:

- `Audio / pitchHz (log raw)` against itself gives a broadly coherent vocal pitch ordering.
- `Pitch Gate` remains useful for removing lower-confidence speech fragments from pitch-focused auditioning.
- Pitch ordering is approximate rather than exact, which is expected for short spoken syllables and noisy consonants.
- `Pitch Focus` and `Audio Focus` now separate more clearly than they did with the older birdsong source.
- `Video Focus` with `motionMagnitude` against `motionMagnitude` behaves like a coherent low-to-high motion scale.
- `motionMagnitude` against `frameDiffEnergy` shows a related but messier trajectory, as expected.
- A small number of video outliers appear to be sharp edit/motion changes rather than descriptor extraction failures.

Interpretation:

- Treat this as a useful speech/gesture regression corpus and a basic video descriptor sanity corpus.
- Do not treat it as the only evaluation corpus; a later multi-source corpus will still be needed for cross-source retrieval tuning.
