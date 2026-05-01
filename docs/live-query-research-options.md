# Live Query Research Options

This document captures one possible research direction for `concatenative-av` without replacing the broader framing in [research-positioning.md](/Users/marcscully/Projects/concatenative-av/docs/research-positioning.md:1).

The point is to keep options open while still naming concrete questions worth testing later.

## Context

The relevant long-term direction is not live mic or webcam as corpus material. It is live input as a query and control layer over a fixed offline audiovisual corpus.

That means:

- the corpus remains prebuilt from source videos
- live voice and/or gesture produce descriptor targets at runtime
- retrieval selects one synchronized `unitId`
- that same `unitId` drives both audio and video

This preserves the core project invariant while opening a performance-oriented research path.

## Why This Matters

There is already substantial work on gesture control in interactive and electroacoustic systems, and there is also prior work on vocal control and live audio corpus querying.

The more specific gap here is narrower:

- how live embodied input maps into a synchronized AV corpus
- how that mapping affects perceived causality and controllability
- whether paired modalities produce better artistic results than single-modality control

So the contribution is unlikely to be "live control exists." The stronger question is how to design and evaluate live query for audiovisual concatenative practice.

## Candidate Research Avenues

### 1. Voice-Only Query

The performer uses live vocal input to steer corpus retrieval.

Potential focus:

- timbral similarity versus abstract behavioral similarity
- phrase-level vocal shaping rather than note-like triggering
- whether vocal input feels musically direct or too unstable

Why it is worth considering:

- clear compositional link to electroacoustic practice
- easy to explain artistically
- strong contrast between human voice and non-vocal corpus material

Main risk:

- it may overlap too strongly with existing live audio concatenative research unless the AV dimension is genuinely central

### 2. Gesture-Only Query

The performer uses webcam-tracked movement or bodily gesture to steer retrieval.

Potential focus:

- motion intensity, stillness, direction, scale, and density
- cross-modal mapping from visual gesture into both sound and image retrieval
- bodily control of montage, continuity, and visual activity

Why it is worth considering:

- likely less saturated than audio-only control
- a strong fit for audiovisual performance research
- makes the body a compositional structuring force rather than just a trigger source

Main risk:

- mapping can feel arbitrary unless the descriptor design and evaluation are disciplined

### 3. Paired Voice + Gesture Query

The performer uses voice and gesture together as a joint control signal.

Potential focus:

- whether the modalities are complementary rather than redundant
- whether one modality should bias retrieval while the other shapes density, continuity, or gating
- whether multimodal control improves phrase-level expressivity and perceived agency

Why it is worth considering:

- this is the richest interaction model
- it aligns with the repo's synchronized AV premise
- it offers a stronger research gap than either single modality alone

Main risk:

- it becomes weak if introduced without single-modality baselines

## Concrete Research Questions

These questions are meant as candidate directions, not as a final locked thesis statement.

### RQ1

How should live voice and gesture be mapped into a synchronized audiovisual concatenative corpus so retrieval feels controllable, perceptually coherent, and artistically useful?

### RQ2

Does paired vocal and gestural input produce better performer control, perceived causality, or compositional usefulness than voice-only or gesture-only query?

### RQ3

Which live-query strategies best balance immediate responsiveness with phrase-level continuity in audiovisual concatenative performance?

## Testable Comparison Frame

A strong way to study this later is to keep most of the system fixed and vary only the live control layer.

Hold fixed:

- corpus source material
- offline segmentation
- descriptor schema
- retrieval metric
- scheduler rules

Compare:

- voice-only query
- gesture-only query
- paired voice + gesture query

Evaluate:

- controllability
- perceived causality
- audiovisual coherence
- temporal continuity
- surprise / novelty
- performer effort
- compositional usefulness

This keeps the study focused. It avoids claiming to solve "multimodal mapping" in general.

## Hypotheses Worth Testing

These are not commitments. They are plausible starting assumptions.

- Voice-only control may produce strong musical and timbral relevance but weaker visual intentionality.
- Gesture-only control may produce strong spatial or visual intentionality but less precise audio expectation.
- Paired input may improve perceived agency if the roles of the modalities are distinct rather than duplicated.
- Overly literal live-to-corpus matching may feel obvious, while overly loose matching may feel arbitrary.

## Sensible Scope For This Repo

If this direction becomes active later, the strongest implementation order is probably:

1. voice-only live query
2. gesture-only live query
3. paired voice + gesture comparison

That order gives a cleaner baseline than jumping straight into multimodal control.

It also fits the current architecture:

- expensive analysis stays offline in the corpus builder
- live runtime computes query descriptors only
- retrieval still chooses one shared `unitId`
- browser or future runtime remains focused on already-built units

## What Not To Claim

Weak framing:

- "this system solves multimodal AV interaction"
- "more input modalities automatically make the instrument better"
- "live control is novel by itself"

Stronger framing:

- this research studies how live embodied input can query a synchronized AV corpus
- it compares single-modality and paired-modality control
- it evaluates the effect of mapping design on coherence, agency, and compositional usefulness

## Provisional Recommendation

If one avenue needs to be prioritized later, the strongest gap appears to be:

paired voice + gesture live query over a fixed synchronized AV corpus, evaluated against single-modality baselines

That said, the repo should not lock itself to that claim yet. The cleaner move is to keep all three avenues visible until corpus behavior, retrieval quality, and performance goals are better understood.
