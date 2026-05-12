# docs/runtime-fixes.md — Phase 0 fixes

Scope: the runtime bugs and UI cleanup that must land before any Electron work. All changes in this doc are to existing files only — no new files, no architecture changes.

After applying this doc, verify in a real browser (`npm run browse:corpus -- --corpus ./corpus`) using an existing built corpus. Do not skip the manual checks at the bottom.

---

## 1. Visual trail / blend-mode fixes

All three fixes are in `tools/corpus-browser/media-runtime.js`. They were diagnosed already; the diffs below are the minimal patches.

### Bug 1 + 2 — the chosen blend mode never applies to a solo grain, and opaque tiles wipe the fade

**Location:** `media-runtime.js:354-360`, inside `renderVisualGrains()`.

**Current code:**

```js
this.context.save();
this.context.globalAlpha = opacity;
this.context.globalCompositeOperation = drawnGrainCount === 0
  ? "source-over"
  : compositeOperationForBlendMode(grain.blendMode);
this.drawAtlasTileToContext(this.context, frame.image, frame.tileIndex);
this.context.restore();
drawnGrainCount += 1;
```

**Why it's broken:** the first grain drawn each frame is always forced to `source-over`. In single-voice playback there's only ever one grain per frame, so the Visual Blend dropdown is dead UI. Because video atlas tiles are opaque and drawn with `source-over`, the new frame replaces the faded previous frame everywhere it covers — so trails never actually accumulate.

**Replacement code:**

```js
const trailsActive = this.visualFeedback.amount > 0;
this.context.save();
this.context.globalAlpha = opacity;
this.context.globalCompositeOperation = trailsActive
  ? compositeOperationForBlendMode(grain.blendMode)
  : (drawnGrainCount === 0
      ? "source-over"
      : compositeOperationForBlendMode(grain.blendMode));
this.drawAtlasTileToContext(this.context, frame.image, frame.tileIndex);
this.context.restore();
drawnGrainCount += 1;
```

When feedback is on, every grain composites onto the persistent (fading) canvas using its chosen blend mode. When feedback is off, behaviour is unchanged from today (first grain establishes, subsequent grains blend).

### Bug 3 — feedback shortens the trail (wrong direction)

**Location:** `media-runtime.js:485`, inside `fadeVideoSurface()`.

**Current code:**

```js
const effectiveDecaySeconds = Math.max(0.04, decaySeconds / Math.max(0.12, feedbackAmount));
```

**Why it's broken:** dividing by `feedbackAmount` means larger feedback → smaller decay window → faster fade. Counter-intuitive: turning feedback up should make the trail *longer*.

**Replacement code:**

```js
const effectiveDecaySeconds = Math.max(0.04, decaySeconds * (0.25 + feedbackAmount * 4));
```

Monotonic: Feedback 0 → effective decay = `decaySeconds * 0.25`; Feedback 0.9 → effective decay = `decaySeconds * 3.85`. Higher feedback = longer trail. Decay control still scales linearly on top.

### Optional follow-up — preserve trails through selection changes

**Location:** `media-runtime.js:387`, inside `drawAtlasTile()`.

**Current code paints a black backdrop unconditionally:**

```js
this.resizeCanvasesForDisplay();
this.paintBlackBackdrop(this.context, this.canvas);
this.drawAtlasTileToContext(this.context, image, tileIndex);
```

This wipes the trail buffer whenever the selection changes (e.g. user clicks a new unit). If the user has feedback on, they probably want the previous trail to survive the selection change.

**Replacement:**

```js
this.resizeCanvasesForDisplay();
if (this.visualFeedback.amount <= 0) {
  this.paintBlackBackdrop(this.context, this.canvas);
}
this.drawAtlasTileToContext(this.context, image, tileIndex);
```

This is optional but cheap. Include it in the same commit.

### Note: do not implement video-feedback warp in v1

The Vasulka-style self-feedback (re-drawing the canvas into itself with a small zoom offset) was proposed as an "optional extra." Defer it — it changes the instrument's character and is not in v1 scope. Note for v2 if it sounds good after Phase 0 is in your hands.

---

## 2. Hide the research / debug UI in production

The user has asked that the "logging windows" be invisible in the shipped app. Don't delete the source — gate it behind a build-time mode flag so the research workflow still works for diagnostics.

### Approach

Add a `data-mode` attribute on `<body>`:

- `data-mode="research"` (default for `npm run browse:corpus`) — everything visible.
- `data-mode="production"` (set by the Electron renderer) — descriptor tables, scatter plot, Nearest Units list, and status strings are hidden via CSS.

### `tools/corpus-browser/index.html`

Add the attribute to `<body>`:

```html
<body data-mode="research">
```

### `tools/corpus-browser/styles.css`

Append at the end of the file:

```css
body[data-mode="production"] .descriptor-panel,
body[data-mode="production"] .scatter-panel,
body[data-mode="production"] .list-panel,
body[data-mode="production"] #status-line,
body[data-mode="production"] #video-status {
  display: none;
}
```

Notes:

- `descriptor-panel` is the raw-vs-normalized descriptor tables (lines ~190–198 in `index.html`).
- `scatter-panel` is the embedding scatterplot (lines ~169–188). The scatter view is research-oriented; the XY pad for *playing* the instrument should be reinstated in v2 as a separate, dedicated control. Hiding the scatterplot for v1 is acceptable because the existing instrument can be played via the Selection list, keyboard arrows, and the grain controls.
- `list-panel` is the Nearest Units list (lines ~147–151). **Hidden in production per user decision.** The Selection panel above it remains visible.
- `#status-line` and `#video-status` are status text strings. Other code writes to them, so the elements must remain in the DOM — only their visibility is hidden in production.

### `tools/corpus-browser/main.js`

When running inside Electron (a Phase 1 concern, but stub it now so Phase 0 verification is one-shot), the renderer can flip the mode by reading a preload-exposed flag:

```js
// near the top of boot()
if (typeof window !== "undefined" && window.app?.isElectron) {
  document.body.dataset.mode = "production";
}
```

In Phase 0, `window.app` does not exist yet, so this is a no-op. The default `data-mode="research"` from the HTML remains in force when running via `npm run browse:corpus`.

---

## 3. Verification

After applying §1 and §2:

```sh
npm run verify
npm run browse:corpus -- --corpus ./corpus    # against an existing built corpus
```

Manual checks in the browser:

| # | Settings | Expected |
|---|---|---|
| 1 | Feedback = 0, Blend = Normal | No trail. Each frame replaces the previous. |
| 2 | Feedback = 0.6, Blend = Add | Bright accumulating trails, blend mode visibly active. |
| 3 | Feedback = 0.6, Blend = Difference | Flickery decay trails, ghostly inversion. |
| 4 | Feedback = 0.9 vs 0.3 (same Decay) | 0.9 trail noticeably *longer* than 0.3. |
| 5 | Trigger Stutter then change selection mid-trail | If §1 optional fix applied: trail survives. If skipped: trail blanks (acceptable in v1). |
| 6 | Visual Blend = Screen, single voice | Screen blend visibly different from Normal (proves Bug 1 is fixed). |

If any of 1–4 or 6 fail, the patch is incorrect — re-read the diff. Check 5 is informational.

Then also confirm:

- `data-mode="research"` (the default) still shows descriptor tables, scatter plot, Nearest Units list, and status text — everything visible for diagnostic work.
- Manually editing `<body>` in devtools to `data-mode="production"` hides descriptor tables, scatter plot, Nearest Units list, and status text, leaving only the instrument surface (controls + Selection panel + video preview).

Once all checks pass, commit as a single change:

```
phase 0: fix visual trails + add production-mode UI flag
```
