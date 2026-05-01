# corpus-builder

Offline Node script: local video files → corpus package assets and metadata.

## Phase 1 scope

- Accept 3–10 short source video files
- Discover supported source video files from a local directory
- Probe source metadata with `ffprobe`
- Export one decoded `.wav` audio asset per source
- Export v1 video as frame atlases (`png` by default, `webp` optional where encoder support exists)
- Segment each source into short AV units using a hybrid onset-aligned heuristic under the corpus min/target/max durations
- Compute engineered audio, video, and joint descriptors per unit
- Store corpus-wide min/max normalization for retrieval
- Compute a 2D PCA embedding from normalized descriptor vectors
- Emit `corpus.json` matching the `AVCorpus` top-level shape in `src/corpus/corpus-types.ts`
- Store source metadata (`sampleRate`, `channelCount`, `frameRate`, dimensions, duration)

## V1 output layout

```text
corpus/
  corpus.json
  audio/
    <source-id>.wav
  atlases/
    <source-id>-001.png
```

The browser runtime should load audio once per source and read scheduled units by
sample range. Video should read units from frame atlases instead of seeking into
source video at runtime. Each `AVUnit.videoAtlasSpans` entry points to an atlas
asset, a starting tile index, and a frame count.

Current scaffold status:

- `sources` metadata is populated from real media probes
- `audio/` and `atlases/` assets are exported
- `units` now contain source-relative timing, adjacency, atlas spans, raw descriptors, normalized descriptors, and `embedding2D`
- individual source failures are reported and skipped; the build fails if no source can be processed
- atlas tiles default to the first processed source's native frame dimensions; mixed-size sources are aspect-preserved with padding inside that shared tile size
- segmentation is heuristic, not yet musically tuned: it uses spectral-flux plus RMS-change onset peaks with fallback max-duration cuts
- audio descriptors are computed from mono PCM analysis frames with local FFT and autocorrelation analysis
- video descriptors are computed from low-resolution RGB analysis frames exported through `ffmpeg`

## Dependencies

- Node `>=22.6.0`
- `ffmpeg` (system, via child_process)
- local JS analysis for FFT, normalization, joint descriptors, and PCA

## Current limits

- segmentation is intentionally simple and should be treated as a first-pass heuristic, not a finished musical model
- video descriptors are based on `32x18` analysis frames, which is fast and deterministic but coarse
- `pitchHz` is a lightweight YIN-style autocorrelation estimate; noisy or unpitched units report `0`, and `pitchConfidence` is derived from the same tracker
- corpus v1 uses one shared atlas tile size for all sources, so mixed-resolution corpora preserve aspect ratio but not per-source native pixel dimensions
- the builder assumes a small corpus where piping raw PCM and raw analysis video through `ffmpeg` is acceptable

## Usage

```sh
npm run build:corpus -- --sources ./sources --out ./corpus
```

Tune unit duration during corpus building:

```sh
npm run build:corpus -- --sources ./sources --out ./corpus --min-duration-ms 50 --target-duration-ms 90 --max-duration-ms 160 --overwrite
```

Type-check the builder with:

```sh
npm run typecheck:tools
```
