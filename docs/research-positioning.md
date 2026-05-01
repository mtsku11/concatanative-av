# Research Positioning

This project should not be framed as the first audiovisual concatenative synthesis system. The stronger position is narrower:

> How should synchronized audiovisual material be segmented, described, and queried so that unit substitutions feel perceptually coherent yet creatively surprising?

Plain version:

> How can audio and video clips be recombined so they feel connected, rather than random, while still producing surprising new results?

## Field

The project sits between:

- corpus-based concatenative synthesis
- audiovisual performance systems
- descriptor-based media retrieval
- practice-led audiovisual composition
- perceptual evaluation of coherence, continuity, and surprise

## Related Work

Thomas Zachary, `Audiovisual Concatenative Synthesis and "Replica"` (2019):

- live AV concatenative performance system
- Max/MuBu for audio analysis and corpus matching
- TouchDesigner for video rendering
- synchronized prerecorded AV corpus
- k-NN retrieval and optional higher-level gesture/preset control

Diemo Schwarz, CoCAVS / NIME 2023:

- corpus-based audio plus still-image navigation
- emphasizes descriptor-space interaction and cross-modal artistic association
- points toward short video sequences as a possible extension

Mateo Fayet, `Vivo` (2024):

- explores visual descriptors for multimodal corpus-based interaction
- adjacent to the descriptor-design question in this repo

## Research Gap

The underexplored area for this project is not simply AV concatenation. It is:

- short synchronized AV units cut directly from source video
- time-varying visual material rather than still images
- perceptual evaluation of when nearest-neighbor substitution feels meaningful
- retrieval strategies that balance temporal continuity, descriptor similarity, novelty, and audiovisual coherence
- tooling that supports artistic practice and repeatable inspection

## Contribution Target

The intended contribution is a combination of system building, artistic practice, and evaluation:

- a corpus pipeline for synchronized audio-video units
- segmentation and descriptor methods for coupled AV material
- retrieval strategies that can be judged against perceptual criteria
- a browser-native inspection tool for corpus QA and research evaluation
- practice-led findings about what kinds of AV montage language emerge from descriptor-driven substitution

The knowledge claim should be:

> This research identifies principles for making synchronized audiovisual concatenation perceptually and artistically effective.

Not:

> This research builds the first audiovisual concatenative synthesizer.

## Evaluation Questions

Useful study comparisons:

- Previous/Next versus Play Nearest versus random substitution
- fixed segmentation versus onset-aligned segmentation
- audio-only descriptors versus video-only descriptors versus joint descriptors
- different descriptor weighting presets
- different source corpus types

Useful evaluation criteria:

- unit start cleanliness
- audio continuity
- visual continuity
- audiovisual coherence
- surprise or novelty
- artistic usefulness

## Practical Position

Treat Zachary/Replica as a baseline and reference architecture, not as the target to copy. The current roadmap remains appropriate because it validates the harder prerequisite first: whether segmented synchronized AV units and descriptor-space retrieval produce perceptually useful results.
