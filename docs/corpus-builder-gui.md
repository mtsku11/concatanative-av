# docs/corpus-builder-gui.md — Native corpus-builder UX

Spec for Phase 3 of `PLAN.md`. Replace `npm run build:corpus` (a CLI for researchers) with a native GUI suitable for a paying customer who has never opened a terminal.

---

## 1. Mental model

The app has two screens:

1. **Corpus Library** — list of corpora the user has built. Empty on first run. Buttons: New Corpus, Open Corpus, Reveal in Finder, Rename, Duplicate, Delete.
2. **Instrument** — the existing playback UI from `tools/corpus-browser/`, with the production-mode flag from `docs/runtime-fixes.md` set.

The library is the home screen. Opening a corpus transitions to the instrument. The native macOS menu provides File → New Corpus… and File → Open Corpus Library wherever the user is.

There is no separate "corpus inspector" view in v1 — descriptor tables and scatter plots are research tools and remain hidden in production mode.

---

## 2. First-run experience

If `app.getPath("userData")/corpora/` is empty (no corpora):

- Show the Corpus Library screen.
- Display a welcome card centered in the area:
  > **Welcome to Concatenative AV**
  >
  > To get started, build a corpus from a handful of short video files. The app will analyse them, extract synchronized audio and video units, and let you play them back as an instrument.
  >
  > [ Build your first corpus ]   [ Learn more (opens website) ]

The button triggers the same flow as File → New Corpus.

---

## 3. New Corpus flow

Trigger: File → New Corpus, or the "Build your first corpus" button, or a "New Corpus" button in the library.

Modal stack (each step is a separate modal, not a single multi-step form — keeps recovery simple):

### Step 1 — pick sources

`dialog.showOpenDialog` with:

```js
{
  title: "Choose source videos",
  properties: ["openFile", "multiSelections"],
  filters: [{ name: "Video", extensions: ["mp4", "mov", "m4v", "mkv", "webm", "avi"] }],
}
```

If the user cancels, abort. If they pick fewer than 1 file, abort. Soft warn if they pick more than 20 files (slow build).

### Step 2 — name + quality

A small custom modal (HTML + CSS, rendered in the renderer or via `new BrowserWindow` modal) asking:

- **Corpus name** — text input. Default to a slugified version of the first source file's basename. Required. Validation: `^[A-Za-z0-9 _.-]{1,64}$`, and must not collide with an existing corpus name (the modal calls `listCorpora()` and rejects collisions inline).
- **Quality preset** — radio buttons:
  - **Draft** — coarser segmentation, fewer frames per atlas, fastest build. For trying out sources.
  - **Standard** — the prototype's default values.
  - **High** — finer segmentation, larger atlases, slower build, biggest corpora.
- Buttons: **Cancel** / **Build**.

Quality maps to segmentation params in `tools/corpus-builder/index.ts`. Concretely:

| Preset | unitMinMs | unitMaxMs | targetMs | atlasColumns × Rows | atlasFormat |
|---|---|---|---|---|---|
| Draft | 80 | 320 | 200 | 8 × 8 | jpg |
| Standard | 60 | 240 | 120 | 12 × 8 | webp |
| High | 40 | 200 | 100 | 16 × 12 | webp |

Tune these once Phase 3 is built and tested against real material.

### Step 3 — progress

Replace the modal with a progress dialog:

- Headline: "Building corpus '<name>'"
- Progress bar (0–100%).
- Subheading: current stage in plain English ("Probing sources…", "Extracting audio…", "Generating atlas frames…", "Computing descriptors…", "Normalising and writing corpus.json…").
- Elapsed time.
- **Cancel** button. Clicking it disables further input and shows "Cancelling…" until the child exits.

Progress drives off the `PROGRESS <fraction> <stage>` lines the corpus builder must now emit. See `docs/desktop-app-spec.md` §4 for the IPC plumbing.

### Step 4 — completion

On success:

- Hide the progress dialog.
- Toast: "Corpus '<name>' is ready."
- Buttons: **Open Now** (default), **Stay in Library**.

On failure:

- Hide the progress dialog.
- Error dialog with:
  - Plain-English headline ("Couldn't build that corpus.")
  - One-line cause if knowable ("ffprobe couldn't read sample.mp4 — the file may be corrupt.").
  - **Reveal log** button that opens the builder's stderr file in TextEdit.
  - **Try again** / **Close** buttons.

On cancel:

- Builder child receives `SIGTERM`. Any partially-written corpus directory is moved to `<userData>/corpora/.trash/<timestamp>/<name>/` — **not** deleted. Show a one-line note: "Build cancelled. Partial files moved to trash."
- The Trash is purged automatically on app launch if any entry is older than 14 days.

---

## 4. Corpus Library actions

Implemented in main via the IPC surface in `docs/desktop-app-spec.md` §4. UX summary:

| Action | Trigger | UX |
|---|---|---|
| New Corpus | File menu / button | Flow above. |
| Open Corpus | Double-click / Open button | Spawn server against that corpus, transition to instrument. |
| Rename | Right-click / context menu | Inline edit, validate name, IPC `renameCorpus`. |
| Duplicate | Right-click | Prompts for new name, copies the entire corpus folder. |
| Reveal in Finder | Right-click / File menu | `shell.showItemInFolder(corpusPath)`. |
| Delete | Right-click / Delete key | Confirmation dialog. Moves to OS Trash via `shell.trashItem`, never `rm -rf`. |

Right-click context menu is built with `Menu.buildFromTemplate` and shown via `menu.popup({ window })`.

---

## 5. In-instrument access to the library

Once a corpus is open, the user is on the Instrument screen. They must be able to:

- Return to the library (File → Open Corpus Library, or ⌘L). Switching corpora reuses the same window — the embedded server stops and restarts against the new corpus.
- See the active corpus name somewhere unobtrusive. Reuse the existing `#status-line` element in non-production mode — but that's hidden in production. Add a small persistent "Corpus: <name>" string in the panel-header area of the instrument UI, visible in production mode. (Modify `tools/corpus-browser/index.html` minimally.)

---

## 6. File-system shape

Inside `app.getPath("userData")`:

```
Concatenative AV/
├── corpora/
│   ├── <name>/
│   │   ├── corpus.json
│   │   ├── audio/<source-id>.wav
│   │   └── atlas/<source-id>-<n>.webp
│   ├── <other-name>/…
│   └── .trash/
│       └── <timestamp>/<name>/…
├── logs/
│   └── builder-<timestamp>.log    ← stderr of each build
└── settings.json                  ← active corpus name, window bounds
```

Active corpus is stored in `settings.json` so the app reopens to the same one. If the active corpus has been deleted out-of-band, fall back to the library screen.

---

## 7. Validation & error surfaces

- Source video count: 1–50. >50 shows a confirmation ("This will be slow — proceed?").
- Per-source size: warn if any source is >2 GB (atlas memory).
- Disk space: before building, check that the corpora directory has at least 4× the combined source size free. Refuse to start if not.
- Unicode in names: allowed, but the corpus *directory* name uses the slugified ASCII form. Display name is stored inside `corpus.json` under a new field `displayName` (see schema change below).

### Schema change

Add an optional `displayName: string` to `AVCorpus` in `src/corpus/corpus-types.ts`. The corpus directory uses the slug; UI shows `displayName ?? name`. Update `tools/corpus-builder/index.ts` to write this field; update `tools/corpus-browser/main.js` to read it where the current code reads the corpus name.

This is the **only** schema change in v1. Do not add more.

---

## 8. What this UX does **not** include in v1

Defer all of these:

- Editing a built corpus (renaming units, removing units, rebuilding a single source). The corpus is immutable after build.
- Importing / exporting a corpus as a single `.cav` (zip) file.
- Inspecting individual units' descriptors in the GUI (research-only — researchers can `npm run browse:corpus` against the corpus folder directly).
- Building from URL or cloud sources.
- Multiple concurrent builds.
- Sharing corpora across machines.

If a user requests any of these during early sales, note them in v2 backlog inside `PLAN.md`.

---

## 9. Acceptance criteria

- File → New Corpus opens a file picker, then a name+quality modal, then a real progress bar.
- The build can be cancelled mid-flight without crashing the app or leaving the corpora directory in a half-broken state.
- Switching between two corpora works, with no terminal involvement.
- Deleting a corpus moves the folder to OS Trash, recoverable from Finder.
- A user with zero technical knowledge can complete the full New-Corpus flow with only this doc's UX as guidance.
