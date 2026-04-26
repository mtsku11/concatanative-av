# Concatenative AV Roadmap

This plan reframes `granular-av` from a live granular processor into a corpus-based audiovisual concatenative instrument.

Core decision:

1. use prepared video files as corpus material
2. keep live mic/webcam out of v1 synthesis
3. reintroduce live input later only as a query/control source

Reason:

- concatenative AV is strongest when one retrieval decision selects one matched audio-video unit
- that is much easier and much more honest with pre-segmented source material than with live capture
- browser performance is viable when analysis is offline and playback is GPU/audio-worklet friendly

## Scope Decision

Recommended v1:

- corpus built from one or more local video files
- offline segmentation and descriptor extraction
- browser runtime that retrieves and schedules matched AV units
- XY / cluster / density control for performance

Do not make webcam + mic the main path.

Keep them only as future options for:

- querying the corpus by live descriptors
- recording new source material offline
- modulating retrieval targets or continuity

This is not abandoning live input forever. It is removing the hardest, least stable part from the critical path.

## What The Instrument Actually Is

The current engine asks:

- how dense are the grains?
- where do they read from?
- how long do they last?

The concatenative engine adds the more important question:

- which AV unit should fire next from the corpus?

That means the instrument stops being mainly:

- live buffer processing

and becomes:

- corpus analysis
- descriptor search
- continuity-aware AV unit scheduling
- matched audio/video playback

## Feasible Browser Target

This is feasible if the expensive work is moved offline.

Do offline:

- cut source material into short synced AV units
- extract descriptors
- render visual units into an atlas or short clip-friendly format
- build the corpus index

Do in the browser:

- load corpus metadata and media assets
- compute a target descriptor vector from gesture or live analysis
- retrieve candidate units
- schedule one shared AV unit id
- play audio and video in lockstep

Avoid in v1:

- arbitrary video seeking on every grain
- live segmentation into a growing corpus
- live descriptor indexing over raw webcam frames
- full-resolution per-grain video decode at runtime

## Target Architecture

```text
local source videos
-> offline corpus builder
-> segmented AV units
-> descriptor extraction
-> corpus package

runtime control input
(XY / mode / density / optional live descriptor target)
-> target vector
-> retrieval engine
-> continuity / repetition rules
-> shared AV scheduler
-> audio unit player + video unit player
```

Rule:

- one scheduler event chooses one `unitId`
- that same `unitId` drives both the audio grain and the visual grain

No secondary "visual reaction" layer should decide the visual event after audio has already been chosen.

## Corpus Package

Start with a simple browser-readable package:

```ts
type AVCorpus = {
  version: 1;
  sources: CorpusSource[];
  units: AVUnit[];
  descriptorSchema: DescriptorSchema;
};

type CorpusSource = {
  id: string;
  label: string;
  audioAsset: string;
  videoAsset: string;
  atlasAsset?: string;
};

type AVUnit = {
  id: string;
  sourceId: string;
  startMs: number;
  durationMs: number;
  audioStartSample: number;
  audioSampleCount: number;
  videoStartFrame: number;
  videoFrameCount: number;
  descriptors: {
    audio: number[];
    video: number[];
    joint: number[];
  };
  embedding2D?: [number, number];
};
```

V1 descriptor set should stay engineered, not ML-heavy.

Audio:

- RMS
- spectral centroid
- spectral flatness
- spectral flux
- pitch confidence

Video:

- motion magnitude
- frame difference energy
- edge density
- luminance
- saturation

Joint:

- activity
- attackness
- audiovisual roughness or contrast proxy

## Playback Model

Audio side:

- keep `AudioWorklet`
- replace live ring-buffer reads with unit playback from decoded corpus buffers
- each scheduled event still uses grain envelopes, overlap, pan, and gain

Video side:

- do not depend on free-running webcam history as the primary source
- play pre-segmented visual units from packed frames or short clip ranges
- composite overlapping units on the GPU with windowing, opacity, scale, offset, and blend logic

Important distinction:

- the visual result can still look granular, but it should be built from chosen corpus units, not from synthetic history smearing

## Repo-Shaped Direction

Do not force this into one huge `runtime.ts`.

Suggested shape inside `src/granular-av/` or a later extracted repo:

- `corpus/descriptor-schema.ts`
- `corpus/corpus-types.ts`
- `corpus/corpus-loader.ts`
- `corpus/retrieval.ts`
- `corpus/continuity.ts`
- `scheduler/av-scheduler.ts`
- `audio/concatenative-player.worklet.js`
- `video/video-unit-renderer.ts`
- `video/video-atlas.ts`
- `runtime-concat.ts`
- `ConcatenativeAVApp.tsx`

Keep the existing live granular runtime intact until the concatenative path proves itself.

## Phases

## Phase 0: Freeze The Current GranularAV

Goal:

- stop growing the live processor while the concatenative prototype is designed

Tasks:

- treat current `runtime.ts` as the reference live-granular branch
- avoid mixing corpus concerns into the existing shader/audio code until the data model is stable
- extract only reusable utilities later

Definition of done:

- current app remains usable
- new work starts beside it, not inside it

## Phase 1: Offline Corpus Builder

Goal:

- produce a small, coherent AV corpus from local video files

Tasks:

- choose 3 to 10 short source files with strong audiovisual identity
- segment into units around `60` to `240` ms
- extract descriptors per unit
- export `corpus.json`
- export audio assets and either frame atlases or short visual clips

Implementation note:

- this should be a Node/tooling script, not browser code
- `ffmpeg` is the practical base for segmentation and frame export

Definition of done:

- one folder contains everything needed to load and audition units in the browser

## Phase 2: Corpus Browser + Visualizer

Goal:

- inspect the corpus before building the instrument

Tasks:

- load `corpus.json`
- plot units in a simple 2D projection
- hover/select a unit and preview it
- verify descriptor distributions and clustering

Reason:

- bad descriptors will sink the instrument long before playback code does

Definition of done:

- you can see whether the corpus is coherent, sparse, repetitive, or noisy

## Phase 3: Shared Retrieval Engine

Goal:

- choose matched AV units by descriptor target

Tasks:

- implement weighted distance over the joint descriptor vector
- add top-k retrieval
- add repetition penalty
- add source-switch penalty
- add cluster stickiness or continuity bias

Initial target inputs:

- XY pad
- density
- jump/continuity control
- optional mode selector for different weighting profiles

Definition of done:

- moving the controls returns different but intelligible candidate units

## Phase 4: Concatenative Scheduler

Goal:

- turn retrieval into a performable stream of AV events

Tasks:

- schedule unit firing at a controllable density
- choose between exact best match and candidate sampling
- allow overlap
- support freeze as cluster lock or exact-unit lock
- support stutter as repeated scheduling of a small neighborhood

Definition of done:

- the instrument feels like a playable unit-selection engine rather than a preview browser

## Phase 5: Audio Player

Goal:

- render scheduled unit audio cleanly in real time

Tasks:

- decode source audio into buffers
- schedule sample-accurate unit playback in `AudioWorklet`
- apply envelope, gain normalization, overlap management, and pan
- keep density and duration controls available, but subordinate them to unit selection

Definition of done:

- audio playback survives dense overlap without collapse
- unit timing is stable enough for rhythmic and textural playing

## Phase 6: Video Unit Player

Goal:

- render scheduled unit visuals from corpus units rather than from webcam history

Tasks:

- load atlas textures or short clip textures
- map each scheduled `unitId` to its frame span
- support multiple concurrent visual units
- apply temporal windowing and simple transforms
- composite in a way that preserves unit edges without turning into mud

Definition of done:

- visual events clearly correspond to the selected corpus units
- overlap reads as granular layering rather than generic video feedback

## Phase 7: Instrument UI

Goal:

- make the retrieval space and scheduling controls performable

Core controls:

- XY target
- density
- continuity
- freeze/lock
- overlap
- source/cluster bias

Useful optional controls:

- corpus subset enable/disable
- descriptor weighting presets
- unit duration band
- visual blend mode

Definition of done:

- the instrument can be played without exposing analysis internals every time

## Phase 8: Live Input Returns As Query Only

Goal:

- use mic/camera without making them the synthesis corpus

Tasks:

- derive live audio and video descriptors from mic/camera or shared tab
- map those descriptors into the corpus target space
- let live input query the corpus instead of being granulated directly

Why this matters:

- this preserves your original interest in live audiovisual correspondence
- but it avoids the unstable problem of live corpus mutation and arbitrary live video grain seeking

Definition of done:

- live input can steer retrieval while the corpus remains stable

## What To Reuse From Current GranularAV

Useful to reuse:

- `model.ts` as a starting point for shared settings types
- `GranularAVApp.tsx` patterns for full-bleed instrument UI
- `AudioWorklet` boot/loading path
- WebGL boot and resize plumbing

Do not treat as core architecture for concatenative mode:

- history-ring video logic
- grain-state shader scheduling
- webcam-centric input session model

Those belong to the live granular processor, not the corpus instrument.

## MVP Recommendation

The first convincing version is:

1. one curated corpus from local video files
2. offline descriptors
3. XY retrieval space
4. shared AV scheduler
5. overlapping audio + video unit playback
6. freeze as unit or cluster lock

Not recommended for MVP:

- webcam corpus input
- mic corpus input
- live corpus growth
- automatic ML embeddings
- arbitrary web video ingestion

## Open Research Questions

Questions worth testing after the MVP exists:

- which descriptor mix yields the strongest perceptual AV correspondence?
- does one joint vector work better than separate audio/video vectors with weighted fusion?
- should freeze lock one exact unit, one neighborhood, or one descriptor target?
- when does continuity preserve identity and when does it dull the instrument?
- is video atlas playback sufficient, or do short clip textures produce cleaner motion?

## Recommendation

Yes: move away from webcam + mic as the central source model.

Better framing:

- `granular-av` stays the live processor
- the new instrument is a separate concatenative AV branch built from local video corpus material

That is the more realistic build path and the stronger research object.
