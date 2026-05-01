# Authored Narrative in AV Concatenative Synthesis: Literature Review

Date: 2026-04-29

This is a scoping literature review, not a completed systematic review. It checks whether there is a defensible academic gap around authored narrative, metaphor, and semiotic meaning in audiovisual concatenative synthesis.

## Provisional Finding

There appears to be a strong research opportunity, but the claim should be phrased carefully.

Stronger claim:

> Existing work addresses electroacoustic narrative, audiovisual metaphor, audiovisual composition, and corpus-based audiovisual concatenative synthesis, but there is room for further research into how descriptor-driven recombination can be authored and evaluated as a semiotic/narrative compositional practice.

Weaker claim to avoid:

> Nobody has studied narrative, metaphor, or audiovisual concatenative synthesis.

The gap is not in any one parent field. It is at their intersection:

- electroacoustic narrative and source-based meaning
- audiovisual metaphor and sound-image semiotics
- corpus-based concatenative retrieval
- synchronized audiovisual unit substitution
- practice-led authoring and evaluation

## Research Gap Candidate

How can a composer author metaphor, narrative, and semiotic relations in a system where audiovisual events are selected through descriptor-space retrieval rather than fixed linear editing?

More concrete version:

> How do corpus design, segmentation, descriptor weighting, retrieval rules, and scheduling shape the legibility of metaphor and narrative in synchronized audiovisual concatenative synthesis?

This fits `concatenative-av` because the system invariant is that one selected `unitId` drives both audio and video. That makes the project about audiovisual substitution, not audio synthesis plus a visualizer.

## Field 1: Electroacoustic Narrative and Semiotic Meaning

There is substantial work on narrative, source recognition, and meaning in electroacoustic/acousmatic music. This means narrative itself is not the gap.

James Andean's "Sound and Narrative" is directly relevant. He frames acousmatic music as simultaneously musical and narrative, and stresses both composer intention and listener reception. He also argues that recorded referents have particular narrative force in acousmatic music because they connect to embodied real-world experience.

Source: https://www.researchcatalogue.net/view/86118/86119/2710/934

Denis Smalley's spectromorphology is another core foundation. It gives electroacoustic music a vocabulary for sound-shapes, source bonding, gesture, morphology, and listener inference. The relevance here is that concatenative descriptors such as brightness, noisiness, loudness, and onset shape are low-level computational approximations of phenomena that electroacoustic theory has long treated as perceptual and meaning-bearing.

Source: https://www.cambridge.org/core/journals/organised-sound/article/abs/spectromorphology-explaining-soundshapes/A18EBE591592836FC22C20FB327D3232

Implication:

Electroacoustic theory gives a strong way to discuss meaning, but it does not by itself explain how meaning is authored when a system dynamically recombines corpus units by descriptor similarity.

## Field 2: Audiovisual Metaphor and Sound-Image Meaning

Audiovisual metaphor is a legitimate research area, especially in film and media studies.

Kathrin Fahlenbrach's work is particularly relevant. Her 2005 article argues that audiovisual signs rely on embodied physical and affective schemata, and that acoustic qualities can be projected onto visual Gestalt patterns to construct audiovisual metaphors.

Source: https://docs.lib.purdue.edu/clcweb/vol7/iss4/4/

Michel Chion's `Audio-Vision` remains a key foundation for sound-image relations. Its relevance is that audiovisual meaning is not reducible to separate audio and visual channels; sound and image form a transformed perceptual whole.

Source: https://www.ingramacademic.com/9780231185899/audio-vision-sound-on-screen/

Implication:

Audiovisual theory supports the claim that sound-image pairings can create metaphor and meaning, but most of this work concerns authored film/video/audio relations, not descriptor-driven substitution from a corpus.

## Field 3: Audiovisual Composition and Visual Music

Audiovisual composition is also well established. Rudi describes multiple ways computer music and video can be combined, including pre-rendered imagery, rule-generated imagery, passive dependence on external events, and active interaction.

Source: https://pure.hud.ac.uk/en/publications/computer-music-video-a-composers-perspective

Garro's `From Sonic Art to Visual Music` argues that electroacoustic and visual music practices have porous boundaries, and calls for multidisciplinary approaches to complex audiovisual interactions.

Source: https://www.cambridge.org/core/journals/organised-sound/article/abs/from-sonic-art-to-visual-music-divergences-convergences-intersections/3C30DCFDF71E55D5000B8EB0C1147E57

Implication:

Audiovisual composition gives useful context, but the reviewed work generally does not focus on synchronized audiovisual units retrieved from an analyzed corpus.

## Field 4: Corpus-Based Concatenative Synthesis

Corpus-based concatenative synthesis is mature enough that the project should not claim novelty there.

Schwarz and colleagues describe CBCS as a system where segmented, descriptor-analyzed sounds are selected by proximity to a target position in descriptor space. CataRT and related work show this as a compositional, interactive, and performative technique.

Source: https://quod.lib.umich.edu/i/icmc/bbp2372.2007.010/--musical-applications-of-real-time-corpus-based-concatenative?rgn=main;view=fulltext

Schwarz's NIME 2012 paper explicitly frames the "sound space" itself as the instrument: performers navigate descriptor spaces with gestures and trigger sound units.

Source: https://www.nime.org/proceedings/2012/nime2012_120.pdf

Recent audio-only work, such as `The Concatenator`, shows that real-time audio-guided concatenative mosaicing is still active and technically developing.

Source: https://arxiv.org/abs/2411.04366

Implication:

Audio CBCS, descriptor-space navigation, live control, and audio mosaicing are too established to be the core novelty. The research contribution needs the audiovisual and semiotic/narrative dimension.

## Field 5: Audiovisual Concatenative Systems

Audiovisual concatenative synthesis does exist.

Zachary Thomas's 2019 dissertation, `Audiovisual Concatenative Synthesis and "Replica"`, is the most important baseline. It describes audiovisual concatenative synthesis as an analysis-driven granular technique using a multimedia corpus to sequence audio and video on a microtemporal level, and frames the system through granular structure, gesture capture, replication, and composition.

Source: https://digital.library.unt.edu/ark:/67531/metadc1538747/

Diemo Schwarz's CoCAVS/NIME 2023 paper extends corpus-based sound synthesis to the visual domain using still-image corpora, visual descriptors, and gesture-controlled navigation across linked descriptor spaces. It explicitly identifies the question of how to link gesture input to audio and image descriptor spaces. It also notes that descriptor mappings can be part of artistic exploration and narrative development.

Source: https://nime.org/proceedings/2023/nime2023_55.pdf

Mateo Fayet's `Vivo` asks which visual descriptors are suitable for multimodal interaction and how real-time video analysis can integrate with a corpus-based concatenative sound system.

Source: https://arxiv.org/abs/2404.10578

Tsiros's work is important for audiovisual correspondence and mapping. His 2014 NIME paper reports exploratory studies on perceived similarity between audio-visual feature mappings for visual control of corpus-based concatenative synthesis. The repository abstract reports that individual audio-visual association pairs mattered more than whole mapping/corpus conditions in one study, while corpus affected detection in another.

Source: https://napier-repository.worktribe.com/output/180728/evaluating-the-perceived-similarity-between-audio-visual-features-using-corpus-based-concatenative-synthesis

Neupert's `Navigating audio-visual Grainspace` is a relevant early prototype. It combines concatenative synthesis, Kinect-based navigation, and synchronized video display along unit playback. The future-work section specifically mentions grading units by video frame analysis.

Source: https://icmi-workshop.org/papers/2012/09_Navigating_Grainspace_audio-visual_Grainspace.pdf

Implication:

AV concatenative synthesis is a real existing area. However, the strongest examples focus on system design, descriptor mapping, gesture control, cross-modal perception, and practice-led performance. They only partially address authored narrative/metaphor as the central research object.

## Field 6: Voice, Gesture, and Embodied Control

Gesture and voice control are not empty gaps either.

The NIME 2022 vocal-interface taxonomy identified 98 voice-centered NIME papers from 2001 to 2021 and frames vocal interfaces as a substantial enough area to require classification.

Source: https://nime.pubpub.org/pub/180al5zt

Reed et al. 2020 argue that voice controllers had been relatively uncommon in NIME compared with other interface concerns, but they still identify existing voice-as-controller and vocal synthesis controller traditions.

Source: https://www.nime.org/proceedings/2020/nime2020_paper88.pdf

CAVI is useful as an adjacent audiovisual instrument-composition. It uses body action and machine learning in a coadaptive audiovisual performance system, and its authors explicitly discuss the system as both composition and instrument.

Source: https://nime.pubpub.org/pub/cavi

Implication:

Voice and gesture input should not be claimed as novel by themselves. A stronger later claim would be about how voice and gesture act as live query layers into a synchronized audiovisual corpus, and whether that improves causality, agency, or narrative/metaphorical legibility.

## What Seems Underexplored

The strongest underexplored area is not:

- live control
- audiovisual performance
- electroacoustic narrative
- audiovisual metaphor
- corpus-based concatenative synthesis
- audiovisual concatenative synthesis as a system category

The stronger underexplored intersection is:

- authoring semiotic/narrative intention through corpus preparation and descriptor design
- evaluating whether listeners perceive metaphor or narrative in descriptor-driven AV recombination
- comparing fixed authored montage with dynamic descriptor-based substitution
- understanding when similarity-based retrieval supports meaning and when it undermines it
- studying the role of corpus identity in metaphorical transformation, such as voice gestures answered by bird material
- designing retrieval constraints that preserve both perceptual coherence and symbolic/narrative trajectory

## Confidence Assessment

High confidence:

- The references above are legitimate anchors for the parent fields.
- CBCS and audio-only live mosaicing are established enough that they should not be framed as the core novelty.
- Audiovisual concatenative synthesis has clear precedents, especially Thomas/Replica and Schwarz/CoCAVS.
- Narrative, metaphor, and semiotic meaning are well-established in electroacoustic and audiovisual theory.

Medium confidence:

- The exact intersection of authored narrative/metaphor with synchronized AV concatenative retrieval is underdeveloped.
- A practice-led project could make a credible contribution by building works, documenting corpus/retrieval decisions, and evaluating listener/composer interpretation.

Lower confidence until a systematic database review:

- That this is the "biggest" gap in the field.
- That no dissertation, chapter, or non-indexed practice-led work has already addressed this intersection in depth.
- That all relevant non-English work has been captured.

## Recommended Research Framing

Best current framing:

> Authored metaphor and narrative in audiovisual concatenative synthesis: how descriptor-based recombination of synchronized audiovisual units can produce perceptually coherent and semiotically meaningful electroacoustic works.

Possible research questions:

1. How do corpus construction, segmentation, descriptor choice, and weighting influence the emergence of metaphor and narrative in audiovisual concatenative synthesis?
2. When do descriptor-driven audiovisual substitutions read as meaningful metaphor, and when do they read as arbitrary collage?
3. How does the listener's interpretation of narrative differ between fixed audiovisual montage and dynamically retrieved audiovisual corpus recombination?
4. Can live voice or gesture function as a metaphorical query into a fixed audiovisual corpus rather than only as an instrumental control input?

## Suggested Evaluation Design

The evaluation should combine practice-led analysis with listener/perceiver evidence.

Possible method:

- compose two or more short studies using the same corpus
- compare fixed temporal order, nearest-neighbor descriptor retrieval, weighted metaphor-oriented retrieval, and random retrieval
- collect listener descriptions without giving the intended metaphor first
- ask listeners to rate coherence, causality, symbolic association, surprise, and narrative clarity
- compare listener reception with composer intention using a poietic/esthesic frame
- include reflective notes on how corpus curation and descriptor choices changed the work's meaning

This would connect well with Andean's composer/listener distinction and with the repo's current browser evaluation loop.

## Practical Implication for This Repo

The current technical roadmap remains useful, but the research framing should widen from only perceptual coherence to include semiotic authoring.

Current technical questions:

- Are unit starts clean?
- Does nearest-neighbor retrieval feel coherent?
- Do audio and video substitutions feel connected?

Expanded research questions:

- What do substitutions signify?
- Do retrieved units operate as icon, index, symbol, metaphor, memory, disruption, or narrative turn?
- Can descriptor weights be tuned for metaphorical relation, not just perceptual similarity?
- Can a corpus browser support annotation of perceived meaning as well as raw descriptor inspection?

## Bottom Line

There is a credible academic gap, but it is an intersectional gap rather than a blank-field gap.

The strongest claim is:

> Audiovisual concatenative synthesis has been explored as a technical and performative practice, while electroacoustic/audiovisual scholarship has strong tools for narrative and metaphor. What appears less developed is a practice-led and evaluative account of how descriptor-driven audiovisual recombination can be authored so that its substitutions become semiotically and narratively meaningful.

This is a strong fit for the user's prior work on visual metaphor, authored narrative, electroacoustic music, and semiotic analysis.
