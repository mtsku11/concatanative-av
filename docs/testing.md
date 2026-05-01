# Testing And Verification

The default validation command is:

```sh
npm run verify
```

At present this runs TypeScript checks for both source and tools:

```sh
npm run typecheck
```

## Type Checks

Use:

```sh
npm run typecheck:src
npm run typecheck:tools
```

`typecheck:src` validates the shared TypeScript source. `typecheck:tools` validates TypeScript tooling such as the corpus builder through `tsconfig.tools.json`.

## Corpus Builder Smoke Test

Use this when media tooling is available and you have at least one short local source video:

```sh
npm run build:corpus -- --sources ./sources --out /tmp/concatenative-av-smoke/out-seg --overwrite
```

For shorter units, pass explicit segmentation durations:

```sh
npm run build:corpus -- --sources ./sources --out /tmp/concatenative-av-smoke/out-seg --min-duration-ms 50 --target-duration-ms 90 --max-duration-ms 160 --overwrite
```

Expected result:

- `corpus.json` is written
- `audio/` contains one WAV per processed source
- `atlases/` contains frame atlas images
- `units` is non-empty for valid AV sources
- each unit has audio sample spans, video frame spans, `videoAtlasSpans`, normalized descriptors, and `embedding2D`

Dependencies:

- Node `>=22.6.0`
- `ffmpeg`
- `ffprobe`

## Corpus Browser Smoke Test

Run:

```sh
npm run browse:corpus -- --corpus /tmp/concatenative-av-smoke/out-seg
```

Open:

```text
http://127.0.0.1:4173
```

Check:

- the corpus loads without browser console errors
- the scatterplot has visible points
- dragging the scatterplot schedules audible grains
- the canvas shows matching atlas frames
- changing X/Y axes redraws the plot
- distance mode changes update nearest units
- grain controls affect rate, duration, envelope, gain, pitch, jitter, continuity, retrieval penalties, scheduler mode, stutter count, and voices

## Corpus Health Report

Run after rebuilding a corpus:

```sh
npm run health:corpus -- --sources ./sources --corpus /tmp/concatenative-av-smoke/out-seg --out ./reports/corpus-health
```

Expected result:

- `health-report.md` and `health-summary.json` are written
- source metadata is readable
- unit extraction has no invalid durations, out-of-bounds units, or AV boundary mismatches
- descriptors are finite, normalized, and non-flat
- contact sheets and fixed-query match previews are generated

## Golden Canary Regression

The canary corpus is the first audio/pitch-focused regression corpus. After intentionally updating the canary corpus or retrieval behavior, write a new snapshot:

```sh
npm run golden:canaries:write
```

To check that fixed-query retrieval has not changed unexpectedly:

```sh
npm run test:golden:canaries
```

This compares `reports/corpus-health/health-summary.json` against `test-fixtures/golden/canaries/retrieval-snapshot.json`.

## Listening And Viewing Checklist

When evaluating real material, write down perceptual notes for:

- unit starts that feel clean or late
- units that are too short, too long, or chopped
- whether Previous/Next preserves natural continuity
- whether nearest units sound and look related
- whether nearest-neighbor jumps feel coherent, surprising, or arbitrary
- whether audio and video feel coupled or accidentally mismatched
- whether Repeat Pen reduces distracting same-unit loops without killing identity
- whether Source Pen improves phrase continuity or makes the corpus feel too closed
- whether Freeze and Stutter read as deliberate performance gestures rather than broken retrieval

These notes should drive segmentation and descriptor weighting changes.

Useful controlled passes:

- `Neighbor Jitter 0`, `Continuity 0`, `Mode Freeze`: judge exact unit cleanliness.
- `Neighbor Jitter 1-3`, `Repeat Pen 0-0.6`: judge local descriptor relevance and repetition.
- `Neighbor Jitter 4-8`, `Source Pen 0-0.8`: judge whether cross-source substitutions feel legible.
- `Mode Stutter`, `Stutter 2-8`: judge whether repeated unit firing supports rhythm or becomes visually/audio stale.

## Before Handing Work Back

Run `npm run verify` after code or type changes. If media behavior changed and a suitable local source corpus is available, also run the corpus builder and browser smoke tests.

If a check cannot be run, state why.
