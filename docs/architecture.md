# Architecture

`concatenative-av` is organized around offline corpus construction followed by a browser-based prototype instrument. The original corpus browser still serves inspection duties, but it now also contains early retrieval, scheduling, and playback runtime code.

## System Shape

```text
local source videos
-> corpus builder
-> WAV assets + frame atlases + corpus.json
-> corpus browser / future runtime
-> retrieval decision selects one AV unit
-> same unit drives audio and video playback
```

The main invariant is that a scheduler or browser action selects one `unitId`, and that same unit controls the audio slice and the matching video frames. Video should not be a secondary reaction layer chosen after audio.

## Corpus Schema

The canonical types live in `src/corpus/corpus-types.ts`.

`AVCorpus` contains:

- `sources`: probed source video metadata and emitted media asset paths
- `units`: synchronized AV units with source timing, audio sample spans, video frame spans, adjacency, descriptors, and optional `embedding2D`
- `descriptorSchema`: ordered descriptor field names
- `descriptorNormalization`: corpus-wide min/max normalization used for retrieval
- `media`: asset strategy for audio and video
- `segmentation`: segmentation parameters used by the builder
- `embedding`: optional projection metadata for browser visualization

Descriptor array indices must match `DEFAULT_DESCRIPTOR_SCHEMA`.

## Corpus Builder

Path: `tools/corpus-builder/index.ts`

Responsibilities:

- discover supported local video files
- probe media with `ffprobe`
- decode one WAV per source with `ffmpeg`
- export video frame atlases
- extract audio and video analysis frames
- segment into short synchronized AV units
- compute raw audio, video, and joint descriptors
- normalize descriptors across the corpus
- compute a PCA-based 2D embedding for inspection
- write `corpus.json`

Current segmentation is a hybrid onset-aligned heuristic. It is intentionally tunable rather than final.

## Corpus Browser

Path: `tools/corpus-browser/`

Responsibilities:

- serve a corpus package from a local directory
- load `corpus.json`, WAV assets, and atlas images
- plot units by PCA or chosen descriptor axes
- drive a prototype XY performance surface
- compute weighted nearest-neighbor retrieval in normalized descriptor space
- bias retrieval with repetition and source-switch penalties
- schedule overlapping audio grains from selected/retrieved units, with explore, freeze, and stutter modes
- display concurrent visual grains from the same scheduled unit ids
- apply paired audio/visual feedback and decay controls

Current browser module shape:

- `main.js`: DOM wiring, selection state, scatterplot rendering, and high-level orchestration
- `retrieval.js`: distance modes, weighted descriptor distance, nearest-neighbor rows, axis-value lookup
- `grain-engine.js`: density/rate scheduling, neighbor jitter, continuity, retrieval penalties, freeze/stutter modes, envelopes, pitch-rate playback, voice limiting, audio feedback bus
- `media-runtime.js`: decoded source-audio cache, atlas-image cache, audio preview playback, atlas video rendering, concurrent visual grain compositing, blend modes, visual feedback/decay
- `server.js`: local static/corpus server

The browser is now both a research instrument and a prototype runtime. It remains deliberately dependency-free, but larger runtime work should move toward typed source modules once the prototype behavior stabilizes.

## Future Runtime

The prototype runtime still needs:

- sample-accurate or AudioWorklet-backed dense audio playback if browser scheduling becomes limiting
- explicit latency and load testing on larger corpora
- perceptual tuning of segmentation, descriptor weights, retrieval penalties, and scheduler modes
- typed reusable runtime modules outside `tools/` if this becomes the main instrument code path

TouchDesigner is a possible future renderer if browser rendering becomes limiting, but it is not required for Phase 1.
