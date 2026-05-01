# Formal Database Review: Research Gap Options

Date: 2026-04-29

This document records a structured database review for identifying a strong research gap for `concatenative-av`, while keeping the project aligned with the user's existing interests in electroacoustic music, audiovisual composition, visual metaphor, authored narrative, and semiotic analysis.

This is a formal scoping review, not a complete systematic review. It uses database-style searching and explicit screening criteria, but it does not claim exhaustive coverage of paywalled, non-English, non-indexed, or practice-led work.

## Review Question

What is the strongest defensible research gap at the intersection of:

- audiovisual concatenative synthesis
- corpus-based recombination and descriptor-space retrieval
- electroacoustic/audiovisual composition
- authored narrative, visual metaphor, and semiotic meaning
- possible later voice/gesture live-query interaction

## Provisional Answer

The strongest gap is:

> How can descriptor-driven audiovisual concatenative recombination be authored and evaluated so that dynamic unit substitutions produce legible metaphorical, semiotic, or narrative relations, rather than only perceptual similarity, texture, novelty, or technical demonstration?

This appears stronger than a gap framed only around live voice/gesture control. Voice and gesture remain highly relevant, but the better claim is that live input can become a later query layer for metaphorical transformation, not the whole research contribution.

## Databases And Sources Searched

Search date: 2026-04-29.

Sources used:

- OpenAlex
- Crossref
- Semantic Scholar Graph API, limited by rate limiting
- NIME proceedings
- ICMC proceedings via Michigan Publishing and web index results
- arXiv
- institutional repositories, including Goldsmiths, UNT, HAL, Napier, Research Catalogue
- targeted web search for exact titles and phrases

Important limitation:

Google Scholar, ProQuest dissertations, JSTOR, RILM, ACM full text, IEEE Xplore full text, and university library subscription databases were not fully searched from this environment. A later thesis literature review should repeat these searches through library access and export results to Zotero.

## Search Strategy

The search deliberately combined narrow exact-title searches with broader intersection searches.

### Core Search Strings

Exact or near-exact searches:

- `"audiovisual concatenative synthesis"`
- `"corpus-based audiovisual concatenative synthesis"`
- `"corpus-based audio-visual synthesis"`
- `"Sketching Concatenative Synthesis"`
- `"Evaluating The Perceived Similarity Between Audio-Visual Features"`
- `"Musical Interface to Audiovisual Corpora of Arbitrary Instruments"`
- `"Navigating audio-visual Grainspace"`
- `"SoundSpotter" "REMIX-TV"`
- `"Plundermatics" "Real-time Interactive Media Segmentation"`
- `"Audiovisual Resynthesis in an Augmented Reality"`
- `"VIVO" "Video Analysis for Corpus-based Audio-Visual Synthesis"`
- `"Touch Interaction for Corpus-based Audio-Visual Synthesis"`

Intersection searches:

- `"audiovisual concatenative synthesis" "narrative"`
- `"audiovisual concatenative synthesis" "metaphor"`
- `"audiovisual concatenative synthesis" "semiotic"`
- `"corpus-based concatenative synthesis" "narrative" "audiovisual"`
- `"concatenative synthesis" "metaphor"`
- `"concatenative synthesis" "semiotic"`
- `"electroacoustic narrative audiovisual metaphor"`
- `"visual metaphor" "electroacoustic" "audiovisual"`
- `"voice gesture audiovisual concatenative synthesis"`
- `"live input corpus-based concatenative synthesis gesture voice"`

Adjacent-field searches:

- `"Code-Driven Narratives" "Combinatory" "Generative Film"`
- `"The Art of Generative Narrativity"`
- `"Wandering Machines" "Narrativity in Generative Art"`
- `"a method for subjective analysis of audiovisual works"`
- `"Narrativity and Audiovisual Performance"`
- `"audiovisual metaphor" Fahlenbrach`
- `"Sound and Narrative" Andean`

## Indicative Search Results

The counts below are not treated as bibliometric evidence by themselves, because broad search APIs return many false positives. They are useful mainly for showing whether exact intersections are populated or sparse.

OpenAlex exact-title/phrase checks:

- `"Sketching Concatenative Synthesis"` returned 1 result.
- `"Evaluating The Perceived Similarity Between Audio-Visual Features"` returned 1 result.
- `"Musical Interface to Audiovisual Corpora of Arbitrary Instruments"` returned 3 results.
- `"Navigating audio-visual Grainspace"` returned 2 results.
- `"SoundSpotter" "REMIX-TV"` returned 6 results.
- `"Plundermatics" "Real-time Interactive Media Segmentation"` returned 2 results.
- `"Audiovisual Resynthesis in an Augmented Reality"` returned 1 result.
- `"Code-Driven Narratives" "Combinatory" "Generative Film"` returned 1 result.
- `"The Art of Generative Narrativity"` returned 1 result.
- `"a method for subjective analysis of audiovisual works"` returned 1 result.
- `"Narrativity and Audiovisual Performance"` returned 2 results.

Broad OpenAlex searches were noisy:

- `audiovisual concatenative synthesis` returned many unrelated audiovisual speech, multimodal ML, and synthesis results unless filtered manually.
- `audiovisual concatenative synthesis narrative`, `metaphor`, or `semiotic` did not surface a clear central prior work on authored narrative/metaphor in AV concatenative synthesis.

Targeted web searches similarly found relevant parent-field material, but did not surface a work that centrally addresses authored semiotic/narrative meaning in descriptor-driven synchronized AV concatenative recombination.

## Inclusion Criteria

Included sources met at least one of these criteria:

- directly concerned corpus-based concatenative synthesis
- directly concerned audiovisual concatenative synthesis or AV media recombination by analysis/retrieval
- concerned gesture, voice, or embodied interaction with corpus-based systems
- concerned audiovisual narrative, metaphor, semiotics, or analysis in a way relevant to authored AV/electroacoustic work
- concerned generative, database, or combinatory audiovisual narrative

## Exclusion Criteria

Excluded or de-prioritized:

- audiovisual speech synthesis and talking-head TTS, unless useful only as terminology background
- general multimodal deep learning papers not concerned with artistic AV recombination
- purely technical MIR/audio retrieval papers without compositional or audiovisual relevance
- general film narrative theory unless it addressed database/generative/audiovisual structure
- live visuals/VJ practice that did not involve corpus analysis, retrieval, or unit recombination

## Evidence Cluster 1: Audio Corpus-Based Concatenative Synthesis Is Established

Audio corpus-based concatenative synthesis is not the gap.

Schwarz's work on CataRT and real-time corpus-based concatenative synthesis provides the core paradigm: segmented sound units are analyzed, described, selected by distance in descriptor space, and concatenated. The technique already has a history around musical sound synthesis, real-time navigation, descriptor design, target matching, and interaction.

Key sources:

- Diemo Schwarz, "Concatenative Sound Synthesis: The Early Years" (2006)
- Diemo Schwarz et al., ["Musical Applications of Real-Time Corpus-Based Concatenative Synthesis"](https://quod.lib.umich.edu/i/icmc/bbp2372.2007.010/--musical-applications-of-real-time-corpus-based-concatenative?rgn=main;view=fulltext) (ICMC 2007)
- Diemo Schwarz, ["The Sound Space as Musical Instrument"](https://www.nime.org/proceedings/2012/nime2012_120.pdf) (NIME 2012)
- The recent ["Concatenator"](https://arxiv.org/abs/2411.04366) paper shows audio-only real-time mosaicing is still active.

Implication:

The project should not claim novelty for descriptor-based audio retrieval, audio mosaicing, or live audio-driven corpus navigation.

## Evidence Cluster 2: Audiovisual Concatenative And AV Retrieval Systems Exist

Audiovisual concatenative synthesis is not empty territory.

Nick Collins's 2007 ICMC paper, ["Audiovisual Concatenative Synthesis"](https://citeseerx.ist.psu.edu/document?doi=0b97682f0264f4b2d51f422a20b416ba9e9b75aa&repid=rep1&type=pdf), is an important early baseline. It describes joint audiovisual feature vectors, audiovisual frame/grain timescales, feature weighting, and the difficulty of predicting results when many low-level features interact. This is directly relevant to `concatenative-av`.

Casey and Grierson's ["SoundSpotter / REMIX-TV"](https://quod.lib.umich.edu/i/icmc/bbp2372.2007.205/--soundspotter-remix-tv-fast-approximate-matching-for-audio?rgn=main%3Bview%3Dfulltext) (ICMC 2007) is another important baseline. It uses real-time matching from an audio input stream to continuous audio or video databases, and explicitly discusses non-linear re-editing of cinematic material.

Grierson's ["Plundermatics"](https://doi.org/10.14236/ewic/eva2009.32) (EVA 2009) extends the terrain into real-time media segmentation, audiovisual analysis, search, composition, and performance.

Parag Mital's doctoral thesis, ["Audiovisual Scene Synthesis"](https://research.gold.ac.uk/id/eprint/10662/) (2014), is adjacent rather than identical. It frames computational audiovisual scene synthesis as generative collage using perceptually inspired representations, with practical outputs including YouTube-based resynthesis and augmented reality from learned fragments.

Neupert's ["Navigating audio-visual Grainspace"](https://www.icmi-workshop.org/papers/2012/09_Navigating_Grainspace_audio-visual_Grainspace.pdf) (2012) and Gossmann/Neupert's ["Musical Interface to Audiovisual Corpora of Arbitrary Instruments"](https://www.nime.org/proceedings/2014/nime2014_296.pdf) (NIME 2014) are especially close to the current project. They combine feature-analyzed audiovisual material, gesture/contactless navigation, synchronized video playback, and real-time cut-up aesthetics.

Zach Thomas's ["Audiovisual Concatenative Synthesis and Replica"](https://digital.library.unt.edu/ark:/67531/metadc1538747/) (2019) is a major dissertation baseline. It directly frames AV concatenative synthesis as an analysis-driven granular technique using a multimedia corpus to sequence audio and video streams on a microtemporal level.

Schwarz's ["Touch Interaction for Corpus-based Audio-Visual Synthesis"](https://nime.org/proc/nime2023_55/) (NIME 2023) and Fayet et al.'s ["VIVO"](https://arxiv.org/abs/2404.10578) (2024) show that visual descriptors, cross-modal mapping, and multimodal corpus-based interaction remain active questions.

Implication:

The project should not claim to invent audiovisual concatenative synthesis. The gap must be more specific.

## Evidence Cluster 3: Mapping And Embodied Control Are Established But Still Open

Gesture and cross-modal mapping are established research areas. They are also still unresolved enough to support a contribution if scoped carefully.

Tsiros's ["Evaluating the Perceived Similarity Between Audio-Visual Features Using Corpus-Based Concatenative Synthesis"](https://www.nime.org/proceedings/2014/nime2014_484.pdf) (NIME 2014) is directly relevant because it evaluates perceived associations between audiovisual feature mappings for visual control of corpus-based concatenative synthesis.

Tsiros, Leplatre, and Smyth's ["Sketching Concatenative Synthesis"](https://researchrepository.napier.ac.uk/id/eprint/5707) (2012) explores audiovisual isomorphisms and low-level visual features as control streams for concatenative synthesis.

Schwarz's 2023 CoCAVS paper explicitly frames the artistic-scientific question as how to link gesture sensing to both image descriptors and sound descriptors for a multimodal embodied audiovisual experience.

Voice control is also not empty territory. The NIME 2022 vocal-interface taxonomy identifies a substantial voice-centered NIME literature, and live audio mosaicing has existed for years. Voice remains interesting when treated as an expressive query layer, but not as a standalone novelty claim.

Implication:

Voice and gesture are better positioned as later evaluation conditions or performance modes, not as the project's central academic gap.

## Evidence Cluster 4: Narrative, Metaphor, And Semiotic Meaning Are Established Parent Fields

Narrative, metaphor, semiotics, and sound-image meaning are not empty gaps.

Electroacoustic narrative and source-based meaning have strong foundations in work such as James Andean's ["Sound and Narrative"](https://www.researchcatalogue.net/view/86118/86119/2710/934) and Denis Smalley's spectromorphology.

Audiovisual metaphor and sound-image theory are also established. Kathrin Fahlenbrach's ["Aesthetics and Audiovisual Metaphors in Media Perception"](https://doi.org/10.7771/1481-4374.1280) is especially relevant because it treats audiovisual metaphor as grounded in embodied perception. Michel Chion's `Audio-Vision` remains a core reference for sound-image relations.

Generative and database narrative are also active fields. Coover's ["Code-Driven Narratives"](https://journals.library.torontomu.ca/index.php/InteractiveFilmMedia/article/view/2333) (2025) discusses combinatory cinema, database film, chance, story, memory, and meaning. Grba and Todorovic's ["The Art of Generative Narrativity"](https://iperstoria.it/article/view/1543) (2024) focuses on non-verbal generative art events that incite narrative through audience experience. Vieira's ["Narrativity and Audiovisual Performance"](https://doi.org/10.7559/citarj.v11i1.590) and Ciciliani's ["A Method for Subjective Analysis of Audiovisual Works"](http://hdl.handle.net/2027/spo.bbp2372.2017.082) are relevant to evaluation and analysis.

Implication:

The gap is not narrative, metaphor, or semiotics by themselves. The gap is how those modes of meaning are authored and evaluated inside descriptor-driven audiovisual recombination.

## What The Review Did Not Find

The searches did not find a clear central body of work on all of the following at once:

- synchronized audio-video units from source video
- descriptor-driven retrieval or recombination
- audiovisual concatenative synthesis as compositional practice
- authored metaphor, narrative, or semiotic intention as the main object of study
- evaluation of whether listeners perceive those metaphorical or narrative relations

There are close neighbors:

- Collins addresses AV feature vectors and feature weighting, but not narrative/semiotic authoring as the central problem.
- Casey/Grierson address AV retrieval and non-linear narrative re-editing, but not the semiotic evaluation of descriptor-driven unit substitution in electroacoustic AV composition.
- Neupert/Gossmann address audiovisual corpora, embodiment, accountability, and cut-up aesthetics, but not a formal semiotic/narrative research framework.
- Thomas/Replica is directly AV concatenative, but the dissertation's central contribution is system/composition architecture rather than a comparative study of metaphor and narrative legibility in descriptor-driven recombination.
- Tsiros addresses AV feature association and perceived similarity, but the evaluation is about cross-modal correspondence, not authored metaphor/narrative.
- Coover and Grba/Todorovic address generative/database narrativity, but not AV concatenative descriptor retrieval.
- Andean, Smalley, Fahlenbrach, Chion, and related theory provide strong analytical foundations, but not the technical/compositional problem of AV corpus recombination.

## Ranked Gap Candidates

### 1. Strongest And Best Aligned Gap

Authored metaphor and narrative in descriptor-driven audiovisual concatenative synthesis.

Formal version:

> How can corpus construction, segmentation, descriptor choice, descriptor weighting, retrieval constraints, and scheduling be authored so that synchronized audiovisual unit substitutions become semiotically and narratively meaningful?

Why this is strong:

- It directly extends the user's previous work on visual metaphor, authored narrative, electroacoustic audiovisual composition, and semiotic analysis.
- It uses the current repo's technical invariant: one selected `unitId` drives both audio and video.
- It avoids the weak claim that AV concatenative synthesis itself is new.
- It turns descriptor tuning and corpus design into research objects, not just engineering tasks.
- It gives a clear evaluation problem: when do listeners perceive substitution as meaningful metaphor rather than arbitrary collage?

Confidence:

Medium-high. The parent fields are real and established, but this exact intersection appears underdeveloped in the searched material.

### 2. Strong But Secondary Gap

Live voice and gesture as metaphorical query into a fixed audiovisual corpus.

Formal version:

> How do voice and gesture function as live query signals that transform embodied input into metaphorical audiovisual responses from a prebuilt corpus?

Why this is interesting:

- It preserves the offline corpus architecture.
- It connects voice, body, and AV feedback to electroacoustic performance.
- It can produce compelling transformations such as human voice answered through bird, machine, water, or archival corpus material.

Why it should be secondary:

- Gesture mapping and voice control already have large parent literatures.
- Paired voice/gesture input risks becoming too broad unless compared against single-modality baselines.
- It becomes stronger when subordinated to the semiotic/narrative question: what does the corpus response mean?

Confidence:

Medium. This is a good later phase, but not the biggest gap on its own.

### 3. Technical-Perceptual Gap

Short synchronized video-unit retrieval and evaluation.

Formal version:

> Which segmentation, descriptor, and retrieval strategies make short synchronized AV unit substitution feel coherent, legible, and artistically useful?

Why this is useful:

- It is closest to the current repo implementation.
- It is testable with the corpus browser.
- It fits Phase 1 and Phase 2 engineering.

Why it is less distinctive:

- It is more system/perception oriented than personally aligned with the user's semiotic/metaphorical interests.
- It risks becoming an incremental AV descriptor/retrieval study unless connected to meaning.

Confidence:

High as a practical repo question; medium as a thesis-level gap.

### 4. Evaluation-Method Gap

Semiotic evaluation of generative audiovisual systems.

Formal version:

> How can practice-led reflection, listener reports, and semiotic coding be combined to evaluate meaning in generative audiovisual recombination systems?

Why this is useful:

- It could produce a methodological contribution.
- It connects to the user's previous semiotic framework.
- It supports the strongest gap by making the evaluation credible.

Why it is not enough alone:

- It needs a concrete artistic-technical system to evaluate.

Confidence:

Medium.

## Recommended Thesis Framing

Best current framing:

> Authored metaphor and narrative in audiovisual concatenative synthesis: a practice-led and evaluative study of how descriptor-driven recombination of synchronized audio-video units can produce semiotically meaningful electroacoustic audiovisual composition.

Shorter version:

> Semiotic authoring of audiovisual concatenative synthesis.

## Candidate Research Questions

Primary research question:

> How can synchronized audiovisual concatenative synthesis be authored so that descriptor-driven unit substitutions produce legible metaphorical, semiotic, or narrative relations?

Sub-questions:

1. How do corpus selection, segmentation, descriptor schema, descriptor weighting, and retrieval constraints affect the perceived meaning of AV substitutions?
2. When do listeners interpret descriptor-driven AV recombination as coherent metaphor, narrative development, memory, rupture, or transformation?
3. How does descriptor-driven recombination compare with fixed montage and random recombination for narrative clarity, audiovisual coherence, and artistic usefulness?
4. Can live voice or gesture function as a metaphorical query layer that shapes narrative or semiotic relations in a fixed AV corpus?

## Suggested Study Design

Build a small number of practice-led studies using the same source corpus and the same browser/runtime.

Compare:

- fixed authored montage
- random AV unit recombination
- nearest-neighbor descriptor retrieval
- weighted retrieval designed around intended metaphor/narrative
- optional later voice-query or gesture-query retrieval

Collect:

- composer notes on intended metaphor/narrative and descriptor choices
- listener free-response descriptions
- listener ratings for coherence, causality, metaphorical clarity, narrative clarity, surprise, and artistic usefulness
- semiotic coding of listener responses, for example icon, index, symbol, metaphor, memory, rupture, transformation

The important move is to evaluate the difference between perceptual similarity and semiotic usefulness.

## Practical Implications For This Repo

The repo should keep building the offline corpus and browser, but research instrumentation should gradually be added:

- named descriptor-weight presets
- retrieval mode logging
- unit sequence export
- notes per corpus/source/unit cluster
- evaluation session export
- optional tags for composer interpretation, without replacing the low-level descriptor schema
- later voice/gesture query modes as controlled comparison conditions

The current Phase 1 evaluation loop remains valid, but its language should expand:

- not only "does the nearest unit sound/look coherent?"
- also "what kind of relation does the substitution create?"
- "does it read as echo, transformation, contradiction, metaphor, memory, or arbitrary jump?"

## Claim Strength

Strong claim that is currently defensible:

> Prior work establishes corpus-based concatenative synthesis, audiovisual concatenative systems, gesture-controlled AV corpus navigation, audiovisual metaphor theory, and generative/database narrative. However, the searched literature does not reveal a developed body of work on how descriptor-driven synchronized AV unit recombination can be authored and evaluated as a semiotic, metaphorical, and narrative compositional practice.

Claims to avoid:

- "No one has studied AV concatenative synthesis."
- "No one has studied narrative in generative art."
- "No one has studied audiovisual metaphor."
- "Voice and gesture control are novel."
- "This is the biggest gap in the entire field."

Best confidence statement:

> Confidence is high that the parent fields are established and that AV concatenative precedents exist. Confidence is medium-high that authored semiotic/narrative AV concatenative recombination is underdeveloped enough to support a research project. Confidence would become high only after a library-based systematic review across RILM, ProQuest, JSTOR, ACM, IEEE, Scopus, Web of Science, and Google Scholar.

## Next Literature Review Step

For a thesis proposal, repeat this review through institutional access and record:

- database name
- exact search string
- date searched
- number of hits
- number screened
- number included
- exclusion reasons
- exported BibTeX/RIS entries

Priority databases:

- RILM Abstracts of Music Literature
- ProQuest Dissertations and Theses
- JSTOR
- Scopus
- Web of Science
- ACM Digital Library
- IEEE Xplore
- Google Scholar
- NIME proceedings
- ICMC proceedings
- Leonardo
- Organised Sound
- Computer Music Journal
- Journal of New Music Research
- Digital Creativity
- International Journal of Performance Arts and Digital Media

