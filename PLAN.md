# PLAN.md — Build Plan, concatenative-av v1

**Goal:** ship a code-signed, notarized macOS DMG of the concatenative-av instrument with the trail/blend bugs fixed, the research/debug UI hidden, the corpus builder wrapped in a GUI, and ffmpeg bundled. No license activation, no auto-update, no Windows or Linux. macOS-only v1.

This file is the master to-do. Tick boxes as you go. **One phase per commit.** Each phase has a stated *Definition of Done* — if you can't tick all the boxes, the phase is not done.

The reference docs are:

- [`CLAUDE.md`](./CLAUDE.md) — always-loaded operating manual
- [`docs/runtime-fixes.md`](./docs/runtime-fixes.md) — exact diffs for Phase 0
- [`docs/desktop-app-spec.md`](./docs/desktop-app-spec.md) — Electron + ffmpeg + signing
- [`docs/corpus-builder-gui.md`](./docs/corpus-builder-gui.md) — Phase 3 UX spec

---

## Phase 0 — Fix runtime bugs, hide debug UI (browser-only)

Why first: validating the visual behaviour at `http://127.0.0.1:4173` is faster than re-validating it inside an Electron shell. Lock the runtime down before introducing packaging complexity.

- [ ] Apply the three media-runtime fixes from `docs/runtime-fixes.md` §1.
- [ ] Add a `data-mode="production"` (or equivalent) toggle on `<body>` that hides the `descriptor-panel` and `scatter-panel` sections via CSS only. Default this flag to `"research"` so `npm run browse:corpus` still shows everything; the Electron build will set it to `"production"`. See `docs/runtime-fixes.md` §2.
- [ ] Keep `#video-status` and `#status-line` in the DOM (other code writes to them) but hide them from view in production mode.
- [ ] Manually verify in a real browser session against an existing corpus:
  - Solo grain + Blend = "Add" + Feedback = 0.6 → bright accumulating trails.
  - Blend = "Difference" + Feedback = 0.6 → flickery decay trails.
  - Feedback = 0 → no trail at all.
  - Selection change does not blow away an existing trail unless Feedback = 0.
- [ ] `npm run verify` passes.
- [ ] `npm run test:golden:canaries` passes (no analysis math changed — should be a no-op).

**Definition of Done:** Visual blend dropdown is alive for a single voice. Feedback acts monotonically (higher = longer trail). Research panels disappear when production mode is set. Existing CLI workflow still works.

---

## Phase 1 — Electron shell wrapping the existing app

Why this shape: the prototype already runs as a Node HTTP server + browser UI. Electron is the lowest-friction wrap. We do not rewrite the browser code in this phase.

- [ ] Install dev dependencies: `electron`, `electron-builder`, `electron-devtools-installer`, `cross-env`. Pin major versions in `package.json`.
- [ ] Create the directory layout:
  ```
  electron/
    main.js               ← app lifecycle, BrowserWindow, server child
    preload.js            ← contextBridge.exposeInMainWorld("app", { … })
    menu.js               ← native macOS menu (File, Edit, Window, Help)
    server-host.js        ← spawns tools/corpus-browser/server.js with --corpus <dir> --port 0
    corpus-paths.js       ← resolves userData/corpora/<name>, validates
  build/
    entitlements.mac.plist
    icon.icns             ← placeholder until artwork lands
  ```
- [ ] In `main.js`:
  - Set `app.setName("Concatenative AV")` and a unique `app.setAppUserModelId(...)`.
  - Pick a corpus dir from `app.getPath("userData")/corpora/<active>` (create if missing).
  - Spawn `node tools/corpus-browser/server.js --corpus <dir> --port 0`; capture the chosen port from the child's stdout (modify `server.js` to print `READY <port>` on the listen callback — see `docs/desktop-app-spec.md` §3).
  - Create the `BrowserWindow` with `contextIsolation: true`, `nodeIntegration: false`, `sandbox: true`, `webSecurity: true`. Load `http://127.0.0.1:<port>`.
  - On `before-quit`, `SIGTERM` the server child and wait for exit with a 2s fallback to `SIGKILL`.
- [ ] In `preload.js`: expose nothing yet beyond a `version` string. We'll add real APIs in Phase 3.
- [ ] In the index.html bootstrap, detect the Electron context (e.g. `window.app?.isElectron`) and set production mode (Phase 0's flag) so the debug panels are hidden.
- [ ] Add scripts to `package.json`:
  ```
  "dev":          "electron .",
  "package":      "electron-builder --mac --dir",
  ```
- [ ] `npm run dev` opens a window showing the instrument, no terminal, no visible localhost URL, no debug panels.
- [ ] `npm run verify` passes.

**Definition of Done:** Double-clicking the unpackaged `.app` (from `npm run package`) opens the instrument. Quitting the app cleanly terminates the server child (verify with `ps aux | grep server.js`).

---

## Phase 2 — Bundle ffmpeg / ffprobe

Why before the corpus GUI: the GUI is useless without ffmpeg. Better to prove the bundling pipeline against the existing CLI first.

- [ ] Choose a static-build source for ffmpeg/ffprobe. Recommended: download statically linked binaries from a trustworthy build (e.g. `https://evermeet.cx/ffmpeg/` for macOS) per architecture. Document the exact URL + checksum + license posture in `docs/desktop-app-spec.md` §5.
- [ ] Add `resources/ffmpeg/darwin-arm64/{ffmpeg,ffprobe}` and `resources/ffmpeg/darwin-x64/{ffmpeg,ffprobe}`. Gitignore the binaries themselves; check in a `MANIFEST.json` with the version + sha256 of each expected file, and a `scripts/fetch-ffmpeg.mjs` that downloads + verifies them.
- [ ] In `tools/corpus-builder/index.ts`, replace any unqualified `"ffmpeg"` / `"ffprobe"` argv-0 with a resolver that prefers (a) `process.env.CONCAT_FFMPEG`, then (b) `process.resourcesPath/ffmpeg/<arch>/ffmpeg` in packaged builds, then (c) `PATH` for the developer workflow. Mirror for ffprobe.
- [ ] In `electron-builder` config, add the resources to `extraResources` so they ship inside the `.app/Contents/Resources/` bundle.
- [ ] On launch, perform a one-time `ffprobe -version` self-check from the resolved path. If it fails, surface a friendly dialog and refuse to enable corpus-building UI.
- [ ] Confirm `chmod +x` is preserved through packaging (electron-builder usually handles this — verify in the unpacked `.app`).
- [ ] Re-run a corpus build via the existing CLI, but with the bundled binaries (`CONCAT_FFMPEG=$PWD/resources/ffmpeg/darwin-arm64/ffmpeg npm run build:corpus -- --sources ./sources --out /tmp/test-corpus`). Compare `corpus.json` byte-by-byte to a baseline built with system ffmpeg of the same major version — they should match modulo timing-sensitive fields.
- [ ] `npm run test:golden:canaries` against the baseline corpus still passes.

**Definition of Done:** The packaged app contains ffmpeg/ffprobe under Resources. The corpus builder runs end-to-end using the bundled binaries. No `PATH` lookup in the packaged build.

---

## Phase 3 — Native corpus-builder GUI ("New Corpus…")

Full UX spec in `docs/corpus-builder-gui.md`. Summary of work:

- [ ] In `electron/preload.js`, expose the IPC surface listed in `docs/desktop-app-spec.md` §4: `newCorpus`, `openCorpus`, `listCorpora`, `renameCorpus`, `duplicateCorpus`, `deleteCorpus`, `revealCorpus`, `cancelBuild`. All take simple JSON args; main does the work.
- [ ] In `electron/menu.js`, wire native macOS menu items (File → New Corpus…, File → Open Corpus…, File → Reveal Corpus in Finder, Window → Minimize/Zoom/Close).
- [ ] Implement `newCorpus` in main: open a `dialog.showOpenDialog` for source videos (multi-select), prompt for corpus name + quality preset (Draft / Standard / High → maps to segmentation params), spawn the corpus builder as a child process, stream progress (stdout lines parsed for `PROGRESS <0-1> <stage>`) into the renderer via `webContents.send("corpus-build-progress", …)`.
- [ ] Modify `tools/corpus-builder/index.ts` to emit machine-readable progress lines (`PROGRESS 0.42 atlas-export`) on stdout, alongside the existing human logs. The renderer parses these to drive a progress dialog.
- [ ] Add a renderer-side "Corpus Library" view (small left-hand list, replaces nothing else) that calls `listCorpora()` on mount and offers New / Open / Reveal / Delete. Selecting a corpus relaunches the embedded server against that corpus dir and reloads the window. (Simplest path: ask main to restart the server with a new `--corpus` arg.)
- [ ] Add a cancellation path: clicking Cancel during a build sends `cancelBuild`, main sends `SIGTERM` to the builder child, partially-written corpus dir is moved to `<userData>/corpora/.trash/<timestamp>/<name>` (not deleted) so users can recover.
- [ ] `npm run verify` passes.

**Definition of Done:** A user can launch the app, click File → New Corpus…, pick 3 short videos, watch a real progress bar, and open the resulting corpus. No terminal involvement. No localhost URL exposed. Cancel works without crashing.

---

## Phase 4 — Packaging, signing, notarization

- [ ] Acquire Apple Developer credentials (user task; document the env vars `APPLE_ID`, `APPLE_APP_SPECIFIC_PASSWORD`, `APPLE_TEAM_ID` in `docs/desktop-app-spec.md` §6).
- [ ] Fill out `build/entitlements.mac.plist` with the minimum-required entitlements: `com.apple.security.app-sandbox` (probably false for v1 because we spawn ffmpeg), `com.apple.security.cs.allow-jit` (for V8), `com.apple.security.cs.allow-unsigned-executable-memory` only if necessary, `com.apple.security.files.user-selected.read-only` (for source videos), `com.apple.security.files.user-selected.read-write` (for export dialogs). Re-evaluate sandbox in v2.
- [ ] Configure `electron-builder` `mac` block: `target: ["dmg"]`, `hardenedRuntime: true`, `gatekeeperAssess: false`, `entitlements`, `entitlementsInherit`, `notarize: { teamId }`.
- [ ] Add `npm run dist:mac` that runs `electron-builder --mac` with notarization enabled.
- [ ] Test on a clean macOS user account (or `xattr -d com.apple.quarantine` test): the DMG mounts, the app launches without Gatekeeper warnings, `spctl --assess -vv /Applications/Concatenative\ AV.app` returns `accepted`.
- [ ] Smoke-test the full flow on the signed build: launch → File → New Corpus → build → open → play. Trails behave per Phase 0 acceptance.

**Definition of Done:** A `Concatenative-AV-0.1.0.dmg` exists, is signed by the user's Developer ID, is notarized, and runs cleanly on a Mac that has never seen the source tree.

---

## Phase 5 — Pre-release polish (lightweight)

Only what's needed to be sellable. Anything bigger goes to v2.

- [ ] App icon (real artwork, not placeholder) at all required sizes in `build/icon.icns`.
- [ ] About panel: app name, version, copyright, ffmpeg version + license attribution.
- [ ] First-run experience: if no corpora exist, show a short welcome card with a "Build your first corpus" button that triggers File → New Corpus.
- [ ] Friendly error dialogs for the common failure modes: ffmpeg missing (should never trigger in a packaged build, but defensive), source video unreadable, disk full, corpus.json corrupt.
- [ ] README rewrite: replace research-prototype Quick Start with desktop-app install instructions and a screenshot. Keep the research README content under `docs/research-readme.md` for archival reasons.
- [ ] LICENSE chosen and added (user decision — note in `docs/desktop-app-spec.md` §7).

**Definition of Done:** A friend who has never opened a terminal can install the DMG, build a corpus from videos in `~/Movies`, and play the instrument.

---

## Out of scope for v1 — explicit defer list

These are tempting and should be **deferred to v2**:

- License activation server, key entry UI, hardware fingerprinting.
- Auto-updates (electron-updater + signed update artifacts).
- Windows + Linux builds.
- AudioWorklet rewrite of the scheduler.
- TypeScript port of the browser JS modules.
- Importing/exporting corpora as a single `.zip` file (helpful, but not blocking a sale).
- Live mic/webcam as a query layer.
- TouchDesigner renderer integration.
- Cloud-hosted shared corpora.
- A more sophisticated descriptor model (e.g. learned embeddings).

If a v1 phase makes any of these meaningfully harder later, leave a one-line note in the relevant `docs/` file. Otherwise, don't think about them.

---

## Risk register

- **FFmpeg licensing.** Static builds with libx264 / libfdk-aac may impose GPL or non-free terms incompatible with commercial redistribution. Audit the binary's `--license` output and the build's codec set before packaging. Documented in `docs/desktop-app-spec.md` §5.
- **macOS notarization rejection.** Most common cause is unsigned helper binaries — `ffmpeg` and `ffprobe` must be signed during the codesign step. Electron-builder does this if `mac.binaries` is configured. Verify with `codesign --verify --deep --strict /Applications/Concatenative\ AV.app`.
- **Hardened-runtime + JIT.** V8 needs `allow-jit`. If you also need `allow-unsigned-executable-memory`, document why before adding it.
- **Server child orphans.** If main crashes, the spawned Node server can outlive it. Use `detached: false` and a `before-quit` cleanup, plus a startup check that kills any orphaned `server.js` listening on `127.0.0.1:<known-port-range>`.
- **Atlas-image memory.** A large corpus has many atlas PNG/WebP files; `CorpusAssetCache` in `media-runtime.js:1-47` caches them indefinitely. Watch for OOM on big corpora in Phase 3 testing. Mitigation if needed: LRU eviction in the cache.

---

## Acceptance checklist for v1 release

- [ ] All five phases ticked above.
- [ ] DMG mounts and installs on a clean Mac account.
- [ ] No localhost URL is visible in the production UI.
- [ ] Debug/research panels are hidden in the production UI.
- [ ] Trails behave per `docs/runtime-fixes.md` acceptance criteria.
- [ ] ffmpeg / ffprobe ship inside the bundle and never fall back to system `PATH`.
- [ ] App is signed, notarized, and Gatekeeper-clean.
- [ ] User-data corpus path resolves to `~/Library/Application Support/Concatenative AV/corpora/`.
- [ ] Quitting the app terminates all child processes (verified with `ps`).
- [ ] LICENSE chosen.
- [ ] First-run welcome works against an empty corpora directory.
