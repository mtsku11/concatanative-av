# concatenative-av

Corpus-based audiovisual concatenative synthesis research prototype.

The project builds a corpus from prepared local video files, cuts them into short synchronized audio-video units, describes those units with engineered descriptors, and provides a browser tool for inspecting whether retrieval feels coherent, surprising, and artistically useful.

## Current Phase

Phase 1 is focused on offline corpus construction and inspection:

- ingest local source videos
- export WAV assets and video frame atlases
- segment source videos into synchronized AV units
- compute audio, video, and joint descriptors
- normalize descriptors and compute a 2D inspection embedding
- audition and inspect units in the corpus browser

Live microphone or webcam input is intentionally not part of the current synthesis path. It returns later as a query/control layer once the corpus and matching behavior have been validated.

## Quick Start

Install dependencies:

```sh
npm install
```

Verify the repo:

```sh
npm run verify
```

Build a corpus from local videos:

```sh
npm run build:corpus -- --sources ./sources --out ./corpus
```

Browse a corpus:

```sh
npm run browse:corpus -- --corpus ./corpus
```

Then open:

```text
http://127.0.0.1:4173
```

## Requirements

- Node `>=22.6.0`
- `ffmpeg`
- `ffprobe`

## Harness Docs

- `AGENTS.md`: concise instructions for coding agents
- `docs/architecture.md`: current system shape and invariants
- `docs/decisions.md`: accepted project decisions
- `docs/testing.md`: verification and smoke-test workflow
- `docs/research-positioning.md`: research framing and related work
- `docs/roadmap.md`: phase roadmap

## Core Invariant

One selected `unitId` drives both the audio slice and the matching video frames. This project is not an audio engine with a separate visualizer; it is a synchronized AV unit retrieval system.
