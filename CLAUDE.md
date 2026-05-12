# CLAUDE.md — Build Operating Manual

You are working on **concatenative-av**, a corpus-based audiovisual concatenative synthesis instrument. The repo currently exists as a research prototype (Node + browser). The active task is to **convert it into a sellable, code-signed, macOS-first desktop application** while also fixing two known prototype bugs.

This file is the **always-loaded operating manual** for every session on this repo. The single source of truth for *what* to build and *in what order* is [`PLAN.md`](./PLAN.md). When in doubt, follow `PLAN.md`. When `PLAN.md` is silent, follow this file.

`AGENTS.md` describes the prior research-prototype direction. Read it for context, but treat `PLAN.md` as the active brief.

---

## What this product is

A standalone macOS desktop instrument that lets a user:

1. Build a corpus from local video files (offline analysis: ffprobe + ffmpeg, segmentation, descriptor extraction, WAV/atlas export, `corpus.json`).
2. Open a corpus and play it as a concatenative audiovisual instrument (XY pad, density, continuity, freeze/stutter, blend modes, feedback trails).

The **core invariant**, inherited from the prototype, is non-negotiable:

> One scheduled `unitId` drives both the audio slice and the matching video frames. Video is never a secondary reaction layer.

If a refactor risks breaking that invariant, stop and surface it before continuing.

---

## v1 scope — the cut line

In scope for v1 (macOS-only):

- **Fix the trail/blend visual bugs** (see `docs/runtime-fixes.md`).
- **Strip the testing-only logging/debug UI** so the production app shows only the instrument surface (see `docs/runtime-fixes.md`).
- **Electron shell** that boots the existing browser app, owns the lifecycle, hides the localhost URL, and launches the local server on a **random free port** internally (see `docs/desktop-app-spec.md`).
- **Bundled `ffmpeg` and `ffprobe`** binaries for `darwin-arm64` and `darwin-x64`. The user must never be asked to install ffmpeg.
- **Native corpus-builder GUI**: a "File → New Corpus…" flow that replaces the `npm run build:corpus` CLI for end users (see `docs/corpus-builder-gui.md`).
- **OS-standard corpus storage** in `app.getPath("userData")/corpora/<name>/`.
- **Code-signed + notarized DMG** for macOS (Apple Silicon + Intel via universal binary or two DMGs).
- **No license activation** — v1 ships as a paid download with no server-side check. Plan hook points but do not implement.

Out of scope for v1 (defer to v2):

- Windows / Linux builds.
- License keys, payment integration, auto-updates with signed update artifacts.
- AudioWorklet rewrite of the scheduler.
- Live mic/webcam input as query layer.
- TouchDesigner renderer.
- TypeScript port of `tools/corpus-browser/*.js`. Keep them JS for v1.

When you are tempted to add anything not in the in-scope list above, **stop and ask the user**.

---

## Repo shape

```
concat-av-app/
├── CLAUDE.md                       ← this file
├── PLAN.md                         ← phased build plan (master to-do)
├── AGENTS.md                       ← prior research-prototype notes (historical)
├── README.md                       ← current research README
├── package.json                    ← Node 22.6+, TS toolchain, scripts
├── src/corpus/corpus-types.ts      ← canonical schema — do not rename fields
├── tools/
│   ├── corpus-builder/index.ts     ← offline analysis pipeline (ffmpeg/ffprobe)
│   ├── corpus-browser/
│   │   ├── server.js               ← localhost static server (becomes internal)
│   │   ├── index.html              ← UI shell
│   │   ├── styles.css
│   │   ├── main.js                 ← orchestration + DOM wiring
│   │   ├── retrieval.js            ← distance modes, weighted descriptors
│   │   ├── grain-engine.js         ← scheduler, voices, audio feedback bus
│   │   └── media-runtime.js        ← visuals, atlas, trails ← BUG SITE
│   ├── corpus-health/index.ts      ← analysis tool (devops only)
│   └── golden-retrieval/index.ts   ← regression snapshots (devops only)
└── docs/
    ├── desktop-app-spec.md         ← Electron, ffmpeg, signing, packaging
    ├── runtime-fixes.md            ← exact diffs for trail/blend + UI cleanup
    └── corpus-builder-gui.md       ← native New Corpus flow spec
```

New directories to be created during the build:

```
electron/                           ← main process, preload, IPC, menus
build/                              ← electron-builder config, entitlements, icons
resources/ffmpeg/                   ← bundled binaries (gitignored after first prove-out)
```

---

## Hard rules

1. **Preserve the invariant.** One `unitId` → matched audio + video. Do not introduce a second selection path for video.
2. **No nodeIntegration in the renderer.** Always `contextIsolation: true`, `nodeIntegration: false`, `sandbox: true` where compatible. All privileged work (filesystem, spawning ffmpeg, reading corpus paths) goes through a narrow preload IPC surface.
3. **Validate every path crossing the IPC boundary.** Corpus paths must resolve inside `app.getPath("userData")/corpora/` or a user-picked dialog path. The existing `safeJoin` guard in `server.js:122-129` is the model — extend, do not weaken.
4. **Random free port for the embedded server.** Never hardcode `4173` in production. Use `server.listen(0, "127.0.0.1", …)` and pass the chosen port to the renderer via IPC, not via a hardcoded URL.
5. **Bundled ffmpeg only.** Never call `ffmpeg` or `ffprobe` from `PATH` at runtime. Resolve them to `process.resourcesPath` in the packaged app and to a dev-only path during `npm run dev`.
6. **One `unitId` is the canonical key.** Do not duplicate `id` strings across renamed fields. The schema in `src/corpus/corpus-types.ts` is the contract.
7. **Do not modify `tools/corpus-builder/index.ts` analysis math** while fixing UI bugs. Segmentation, descriptors, normalization, and embedding output are perceptually tuned. Touching them invalidates `test-fixtures/golden/canaries/retrieval-snapshot.json`.
8. **Keep the descriptor-array order** dictated by `DEFAULT_DESCRIPTOR_SCHEMA`. Indices are positional.
9. **Never bypass git hooks or signing.** No `--no-verify`, no `--no-gpg-sign`.
10. **Do not delete user corpora.** Any "remove corpus" UI moves the folder to OS trash, not `rm -rf`.

---

## Commands

Existing (still work):

```sh
npm install
npm run verify              # typecheck both tsconfigs
npm run build:corpus -- --sources ./sources --out ./corpus
npm run browse:corpus -- --corpus ./corpus
npm run health:corpus
npm run test:golden:canaries
```

New scripts to add in Phase 1 (see `PLAN.md`):

```sh
npm run dev                 # electron-forge start or electron . with dev flags
npm run package             # electron-builder --mac --dir
npm run dist:mac            # electron-builder --mac (signed + notarized DMG)
```

Always run `npm run verify` before declaring a phase done. Run `npm run test:golden:canaries` after touching anything in `tools/corpus-builder/`.

---

## Where the known bugs live

Three issues are already diagnosed. Exact line numbers and replacement code are in [`docs/runtime-fixes.md`](./docs/runtime-fixes.md). Summary:

| # | File | Lines | Symptom |
|---|---|---|---|
| 1 | `tools/corpus-browser/media-runtime.js` | 354–360 | Visual Blend dropdown is dead for a solo grain (first grain forced to `source-over`). |
| 2 | `tools/corpus-browser/media-runtime.js` | 354–360, 387 | Opaque atlas tiles drawn with `source-over` wipe the fade, so trails never accumulate. |
| 3 | `tools/corpus-browser/media-runtime.js` | 485 | `effectiveDecaySeconds = decaySeconds / feedbackAmount` makes more feedback shorten the trail. Wrong direction. |

Fix all three in one commit. Verify visually: turn Feedback to ~0.6, set Blend to "Add" → bright accumulating trails. Set Blend to "Difference" → flickery decay trails. Set Feedback to 0 → no trail.

---

## Where the logging UI lives

The "logging windows" the user wants gone are the inspection panels that exist for the research prototype but are not part of the playable instrument. Concretely, the panels in `tools/corpus-browser/index.html` that are descriptor/debugging-oriented:

- `<section class="panel descriptor-panel">` (lines ~190–198) — raw descriptor tables.
- `<section class="panel scatter-panel">` (lines ~169–188) — the embedding scatterplot, axis selectors.
- Status hints driven by `#video-status` and `#status-line` should remain present internally for diagnostic logging but **must not be visible in the production UI**.

Treat these as research-only. Hide them behind a build-time `production` flag rather than deleting the source (we may want them back in v2 corpus-inspection tooling). The exact approach is in `docs/runtime-fixes.md`.

The `Selection` panel is **part of the instrument** — leave it. The `Nearest Units` panel is hidden in production (user decision, 2026-05-12) but the data still flows in state for retrieval — only the rendered list disappears.

---

## Electron architecture (one-paragraph version)

The Electron **main process** owns app lifecycle, the OS menu, file dialogs, and a child Node process that hosts the existing `server.js` on a random localhost port. The main process picks a `userData` corpora directory, spawns `server.js` against it, waits for the chosen port, and tells the renderer via IPC. The **renderer** is the existing `index.html` UI loaded by `BrowserWindow` at `http://127.0.0.1:<port>`. A **preload script** exposes a tiny `window.app` surface — `newCorpus(sources, options)`, `openCorpus(path)`, `listCorpora()`, `revealInFinder(path)`, `quit()` — implemented in main via IPC and `child_process`. Full spec in [`docs/desktop-app-spec.md`](./docs/desktop-app-spec.md).

---

## Working preferences

- **Be terse.** This user already accepts the trade-offs in `PLAN.md` and `docs/`. Don't re-explain the plan when starting a phase.
- **No exploratory refactors.** Do not rewrite `main.js` "while we're in there." Touch the smallest surface that gets the phase done.
- **Test in the browser before packaging Electron.** Bug fixes (Phase 0) should be verified at `http://127.0.0.1:4173` with `npm run browse:corpus`. Only proceed to Electron once trails behave correctly.
- **After every `git push`, follow the global Post-Push Verification Protocol** (in user-level `~/.claude/CLAUDE.md`): confirm the commit landed on the remote with `mcp__github__list_commits` before reporting the task complete.
- **Use the `simplify` skill** at the end of each phase to catch over-engineering before opening a PR.
- **Use the `security-review` skill** before any release candidate build. The Electron preload surface is the most likely place for vulnerabilities.

---

## Skills available

These project-agnostic Claude Code skills are useful during this build:

- `simplify` — run at the end of each phase to surface speculative complexity.
- `security-review` — run before any signed release.
- `review` — run on PRs (if you adopt a PR workflow).
- `fewer-permission-prompts` — run once after early setup to allowlist the `npm` / `node` / `git` calls you'll repeat.

No specialized skills need to be installed beyond what is already available.

## MCPs already installed — use these where they help

Three MCP servers are already wired in. Use them; do not install more without asking first.

- **GitHub MCP** (`mcp__github__*`) — used for the global Post-Push Verification Protocol (`list_commits` to confirm a push landed), PR creation, and reviewing diffs. Repo is `mtsku11/concatanative-av`. Prefer `pull_request_read` / `list_commits` with pagination over wholesale repo dumps.
- **Playwright MCP** (`mcp__playwright__*`) — the right tool for **Phase 0 verification** of trail/blend behaviour. After applying `docs/runtime-fixes.md` §1, start `npm run browse:corpus`, then `browser_navigate` to `http://127.0.0.1:4173`, toggle controls with `browser_click` / `browser_evaluate`, and capture `browser_take_screenshot` against the matrix in `docs/runtime-fixes.md` §3. Also useful in Phase 1 to drive the Electron renderer via its devtools, and in Phase 3 to smoke-test the New Corpus flow.
- **Gmail / Google Calendar / Google Drive MCPs** — not relevant to the build; ignore.

Phase-by-phase MCP use:

| Phase | Primary MCP | Used for |
|---|---|---|
| Phase 0 | Playwright | Visual verification of the six-row trail/blend matrix. |
| Phase 1 | Playwright | Confirm the Electron renderer loads the embedded server and the `data-mode="production"` flag is applied. |
| Phase 2 | (none) | ffmpeg bundling is shell + Node, no MCP needed. |
| Phase 3 | Playwright | Drive the New Corpus modal end-to-end; verify progress dialog. |
| Phase 4 | GitHub | Tag the release, create a draft Release page once the DMG is signed. |
| All | GitHub | Post-push verification — confirm each phase's commit landed on `origin`. |

Not installed, and **do not install without explicit user approval**:

- Any "filesystem" MCP — `Read` / `Write` / `Edit` already cover this.
- Any "npm" or "package-search" MCP — Bash + `npm` is sufficient.
- Any third-party Electron MCP — none are needed; electron-builder is a CLI.

---

## When you finish a phase

1. Run `npm run verify`.
2. Run `npm run test:golden:canaries` if you touched anything under `tools/corpus-builder/`.
3. Invoke the `simplify` skill on the diff.
4. Commit with a message that names the phase from `PLAN.md` (e.g. `phase 0: fix visual trails + strip debug UI`).
5. Update `PLAN.md` — check off the phase, leave the next phase's checklist intact.

Do not start the next phase in the same commit. One phase, one commit.
