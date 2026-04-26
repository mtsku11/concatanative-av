# corpus-builder

Offline Node script: local video files → segmented AV units → descriptors → corpus package.

## Phase 1 scope

- Accept 3–10 short source video files
- Segment into units of 60–240 ms using ffmpeg
- Extract audio descriptors (RMS, spectral centroid, flatness, flux, pitch confidence)
- Extract video descriptors (motion magnitude, frame diff energy, edge density, luminance, saturation)
- Compute joint descriptors (activity, attackness, AV roughness proxy)
- Export `corpus.json` matching `AVCorpus` type in `src/corpus/corpus-types.ts`
- Export decoded audio assets and frame atlases or short visual clips

## Dependencies (planned)

- `ffmpeg` (system, via child_process)
- `fluent-ffmpeg` or raw shell invocations
- `meyda` or custom DSP for audio descriptors
- `sharp` or canvas for frame-level video descriptors

## Usage (not yet implemented)

```sh
node tools/corpus-builder/index.js --sources ./sources --out ./corpus --unit-ms 120
```
