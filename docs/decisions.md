# Decisions

This file records durable project decisions so agents do not reopen settled architecture questions without a clear reason.

## Offline Video Corpus First

Decision: source material comes from prepared offline video files.

Rationale:

- source video gives stable synchronized audio and video material
- expensive probing, decoding, segmentation, and descriptor extraction can happen offline
- retrieval can choose meaningful prebuilt units at runtime
- live capture makes segmentation and synchronization harder before the corpus model is validated

Status: accepted.

## Live Input Is A Future Query Layer

Decision: live mic/webcam input is excluded from Phase 1 synthesis and returns later only as query/control input.

Rationale:

- live input is useful for deriving a target descriptor or gesture signal
- it should query a validated corpus rather than become the corpus source
- this matches the long-term research direction without destabilizing the current prototype

Status: accepted for Phase 1.

## One Unit Drives Both Modalities

Decision: audio and video are selected by the same `unitId`.

Rationale:

- the project is about audiovisual unit substitution, not audio synthesis with a separate visualizer
- shared unit identity preserves the source AV relation
- retrieval quality can be evaluated as audio, visual, and coupled AV behavior

Status: accepted.

## Engineered Descriptors Before Heavy ML

Decision: v1 descriptors are engineered audio, video, and joint features rather than learned embeddings.

Rationale:

- engineered descriptors are inspectable and tunable
- the corpus browser can reveal which features correlate with perception
- learned models can be added later once the evaluation target is clearer

Status: accepted.

## Frame Atlases For V1 Video

Decision: v1 video playback uses offline-generated frame atlases.

Rationale:

- avoids arbitrary source-video seeking during inspection/runtime
- keeps unit lookup explicit through `videoAtlasSpans`
- makes browser playback feasible for small corpora

Status: accepted for v1.

## Corpus Browser As Research Instrument

Decision: the browser is not just a demo; it is the first perceptual evaluation tool.

Rationale:

- segmentation and retrieval quality must be judged by listening/viewing
- Previous/Next, Play Nearest, and scatterplot navigation expose different failure modes
- tuning should be grounded in perceptual notes, not only code inspection

Status: accepted.
