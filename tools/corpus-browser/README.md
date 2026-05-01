# corpus-browser

Local browser for inspecting emitted AV corpus units and testing the first playable concatenative AV instrument prototype.

## What it does

- Loads `corpus.json` from a chosen output directory
- Draws units by PCA or selected descriptor axes
- Includes raw/log pitch axes and a pitch-confidence gate for auditioning pitched organization without low-confidence units dominating the map
- Lets the XY plot drive unit selection and grain scheduling
- Plays matched source-WAV slices with grain rate, duration, envelope, gain, pitch, feedback, decay, jitter, continuity, retrieval-penalty, stutter, freeze, and voice controls
- Plays matched video frames from atlas tiles for the same scheduled `unitId`
- Crossfades normal unit changes and composites overlapping visual grains with duration-controlled envelopes, selectable blend modes, and paired feedback/decay trails
- Shows selected unit descriptors and nearest units in normalized descriptor space
- `Pitch Focus` distance mode heavily weights `pitchHz` and removes video/joint dimensions from nearest-unit lookup
- `Neighbor Jitter` widens the candidate pool in steps of 8 nearest units, so higher settings can reach cross-source matches when they are descriptor-near enough
- `Repeat Pen` makes recently fired units less likely within the jitter candidate pool.
- `Source Pen` makes cross-source jumps less likely when the previous grain came from another source.
- `Freeze` repeats the current XY-selected unit exactly; `Stutter` chooses a unit, then retriggers it for the selected repeat count before retrieving again.

## Module shape

- `server.js`: static/corpus HTTP server
- `main.js`: DOM orchestration and scatterplot UI
- `retrieval.js`: descriptor distance, weighting modes, nearest-neighbor lookup, axis mapping
- `grain-engine.js`: overlapping grain scheduler, candidate selection, retrieval penalties, freeze/stutter modes, audio feedback
- `media-runtime.js`: audio buffer cache, atlas image cache, audio preview, video rendering, visual grain compositing

## Usage

```sh
npm run browse:corpus -- --corpus ./corpus
```

Options:

- `--corpus <dir>`: corpus output directory to serve
- `--port <n>`: local HTTP port, default `4173`

Then open `http://127.0.0.1:4173`.

## Notes

- This is intentionally dependency-free and uses plain HTML/CSS/JS.
- Audio starts from source WAV buffers using each unit's `audioStartSample` and `audioSampleCount`.
- When the grain duration is longer than a short unit, audio loops inside the unit slice and video loops the unit's atlas frames under the requested envelope.
- Video reads atlas tiles from `videoAtlasSpans`; it does not seek source video at runtime.
- For pitch testing, set `X Axis` to `Audio / pitchHz (log raw)`, raise `Pitch Gate`, and set `Continuity` plus `Neighbor Jitter` to `0` if you need the cursor to trigger only the closest plotted unit.
- The video renderer uses canvas 2D compositing so concurrent audio grains have matching visual grains.
- The `Feedback` and `Decay` controls are paired: audio grains feed a Web Audio delay-feedback bus, while visual grains retain and fade the canvas over the same decay window.
- `Divide` uses the native `color-dodge` canvas operation as a real-time divide-like brightening blend.
- Musical judgment is still human work. The browser is for making that audition and tuning loop fast.
