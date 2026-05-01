# Agent Harness

This repo is a research prototype for corpus-based audiovisual concatenative synthesis. Treat the repo as the source of truth; do not rely on chat history for architecture decisions.

## Current Direction

`concatenative-av` uses offline video files as the corpus source. Live microphone or webcam input is not part of the primary synthesis path until a later query/control phase.

The Phase 1 focus is:

- build an offline AV corpus from local source videos
- segment source videos into short synchronized audio-video units
- emit `corpus.json`, decoded WAV assets, and frame atlases
- inspect units in the corpus browser
- tune segmentation and descriptor weighting from listening/viewing feedback

## Key Commands

```sh
npm run verify
npm run typecheck
npm run typecheck:src
npm run typecheck:tools
npm run build:corpus -- --sources ./sources --out ./corpus
npm run browse:corpus -- --corpus ./corpus
```

The corpus browser serves at `http://127.0.0.1:4173` by default.

## Important Paths

- `src/corpus/corpus-types.ts`: canonical corpus schema, descriptor schema, and segmentation defaults
- `tools/corpus-builder/index.ts`: offline media ingestion, segmentation, descriptor extraction, atlas export, and corpus writing
- `tools/corpus-browser/`: local browser for inspecting emitted units
- `docs/roadmap.md`: phase roadmap and original architecture plan
- `docs/architecture.md`: current system shape
- `docs/decisions.md`: durable architecture decisions
- `docs/testing.md`: validation workflow
- `docs/research-positioning.md`: PhD/research framing and related work

## Engineering Rules

- Preserve the central invariant: one selected `unitId` drives both audio and video.
- Keep expensive media analysis offline in the corpus builder.
- Keep runtime/browser work focused on loading, inspecting, retrieving, and scheduling already-built units.
- Do not reintroduce live mic/webcam as a corpus source unless the roadmap is explicitly changed.
- Keep descriptor arrays ordered according to `DEFAULT_DESCRIPTOR_SCHEMA`.
- Store retrieval descriptors normalized in `AVUnit.descriptors`; use `rawDescriptors` only for inspection/debugging.
- Do not make unrelated refactors while tuning segmentation or retrieval behavior.

## Current Evaluation Loop

Use the corpus browser to judge:

- unit start cleanliness
- Previous/Next temporal continuity
- Play Nearest descriptor relevance
- whether visual jumps feel legible or arbitrary
- whether audio/video substitutions feel coherent enough to be artistically useful

Write tuning notes in concrete perceptual language before changing thresholds or weights.
