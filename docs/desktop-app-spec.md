# docs/desktop-app-spec.md — Electron shell, ffmpeg bundling, signing

Spec for Phases 1, 2, and 4 of `PLAN.md`. Read in order.

---

## 1. Why Electron (and not Tauri)

The prototype is Node + browser. The hard parts of shipping this product are not the UI shell — they are bundling local media processing, spawning ffmpeg, owning a local server, code signing, notarization, and (later) auto-updates. Electron embeds Chromium and Node and is designed for exactly this shape.

Tauri is attractive for app size and memory but expects a Rust shell. Wrong tool for v1; revisit in v2 if size/memory become real problems.

---

## 2. Process model

```
┌────────────────────────────────────────────────────────────────────┐
│  Electron main process (Node)                                      │
│   - app lifecycle, menu, dialogs                                   │
│   - spawns: server child  (node tools/corpus-browser/server.js …)  │
│   - spawns: builder child (node tools/corpus-builder/index.ts …)   │
│   - resolves ffmpeg/ffprobe paths                                  │
│   - IPC handlers: newCorpus, openCorpus, listCorpora, …            │
└──────────────────────┬─────────────────────────────────────────────┘
                       │ IPC (contextBridge surface)
┌──────────────────────▼─────────────────────────────────────────────┐
│  Renderer (Chromium, sandboxed)                                    │
│   - existing tools/corpus-browser/index.html + main.js             │
│   - loads from http://127.0.0.1:<random-port>                      │
│   - reads window.app.* for native operations                       │
└────────────────────────────────────────────────────────────────────┘
```

The renderer is intentionally the **existing** prototype UI, unmodified except for the `data-mode="production"` flag (Phase 0) and a small `window.app` integration shim (Phase 3). Do not start migrating the UI to React/Vue/etc. for v1 — wrap, don't rewrite.

---

## 3. Embedded server

Modify `tools/corpus-browser/server.js` so that:

- `--port 0` causes Node to bind a random free port.
- On the `listen` callback, **first** write `READY <port>\n` to stdout, **then** the existing human-readable lines.

The main process spawns the server with `--corpus <dir> --port 0` and a pipe on stdout. It reads stdout line-by-line, blocks until it sees a `READY <port>` line, then constructs `http://127.0.0.1:<port>` and tells the BrowserWindow to load it. After `READY`, the main process keeps the pipe open so the child's logs continue to flow into main's stdout (useful for `--enable-logging`).

Spawn options:

```js
const child = spawn(process.execPath, [
  serverEntry,
  "--corpus", corpusDir,
  "--port", "0",
], {
  stdio: ["ignore", "pipe", "inherit"],
  detached: false,
  env: { ...process.env, NODE_ENV: "production" },
});
```

Lifecycle:

- `app.on("before-quit")` sends `SIGTERM` to the child. Wait up to 2s for `"exit"`, then `SIGKILL`.
- `app.on("second-instance")` focuses the existing window — do not spawn a second server.
- If the child exits unexpectedly while the app is running, show a recoverable error dialog with a "Restart" button.

Switching the active corpus = stop the current server child, spawn a new one with a different `--corpus`, then `webContents.loadURL` to the new port.

---

## 4. IPC surface (`window.app.*`)

Defined in `electron/preload.js` via `contextBridge.exposeInMainWorld`. The renderer must never get a Node `require` or any object with prototype chains reaching Node internals. Pass only JSON-safe values.

```ts
type CorpusSummary = {
  name: string;
  path: string;
  createdAt: string;   // ISO
  unitCount: number;
  sourceCount: number;
};

type NewCorpusRequest = {
  name: string;
  sources: string[];                       // absolute paths from showOpenDialog
  quality: "draft" | "standard" | "high";
};

type BuildProgress = {
  buildId: string;
  fraction: number;                        // 0..1
  stage: string;                           // e.g. "probe", "wav-export", "atlas-export", "descriptors", "embedding"
  message?: string;
};

window.app = {
  isElectron: true,
  version: string,

  listCorpora(): Promise<CorpusSummary[]>,
  openCorpus(name: string): Promise<void>,           // tells main to restart server
  newCorpus(req: NewCorpusRequest): Promise<{ buildId: string }>,
  cancelBuild(buildId: string): Promise<void>,
  renameCorpus(oldName: string, newName: string): Promise<void>,
  duplicateCorpus(name: string, newName: string): Promise<void>,
  deleteCorpus(name: string): Promise<void>,         // moves to userData/corpora/.trash
  revealCorpus(name: string): Promise<void>,         // Finder reveal

  onBuildProgress(cb: (p: BuildProgress) => void): () => void,   // returns unsubscribe
  onActiveCorpusChanged(cb: (name: string) => void): () => void,
};
```

Implementation notes:

- Every `name` argument is validated against `^[A-Za-z0-9 _.-]{1,64}$` in main before being concatenated into a path. Reject anything else.
- Every path computed in main must resolve inside `app.getPath("userData")/corpora/`. Use the same `safeJoin` pattern from `server.js:122-129`. **Extend it, do not weaken it.**
- `newCorpus.sources` paths must come from `dialog.showOpenDialog` (which the renderer cannot fabricate) — but still re-validate that they exist and have video MIME extensions before passing to the builder child.
- The `BuildProgress` stream comes from the builder child's stdout. The builder must be modified to print `PROGRESS <fraction> <stage>` lines. Main parses these and forwards via `webContents.send("corpus-build-progress", …)`. Multiple concurrent builds are out of scope — reject `newCorpus` calls while another build is in flight.

---

## 5. ffmpeg / ffprobe bundling

### License posture

FFmpeg is LGPL by default, but most prebuilt static binaries include GPL components (e.g. libx264, libx265, libfdk-aac). For commercial redistribution:

- **Safe v1 approach:** use a static FFmpeg build configured as **LGPL-only** with mainstream codecs (libvpx, libopus, libvorbis, libtheora, plus FFmpeg's native codecs). This covers the corpus-builder's needs (decode common video formats, encode WAV, export PNG/WebP atlases — none of which require GPL codecs).
- Verify with `ffmpeg -L` (license string in the build) and `ffmpeg -version` (configure flags). Look for `--enable-gpl` — its absence is the safe signal.
- Document the chosen build's source URL, version string, license text, and SHA-256 in this file before Phase 4 (table below).

Acceptable sources (verify each release independently):

- `https://evermeet.cx/ffmpeg/` — macOS static builds, with explicit LGPL variants. Check the metadata page for the configuration string.
- BtbN / autobuild releases on GitHub for cross-platform options.
- Building from source with the LGPL flags is the most defensible option for production.

If GPL must be included for some reason, the app's distribution license must be GPL-compatible. Don't do this for v1.

### File layout

```
resources/
  ffmpeg/
    darwin-arm64/
      ffmpeg
      ffprobe
    darwin-x64/
      ffmpeg
      ffprobe
    MANIFEST.json          ← version, source URL, sha256 for each binary, license string
    LICENSE.ffmpeg.txt     ← bundled FFmpeg license text (required by LGPL)
  scripts/
    fetch-ffmpeg.mjs       ← downloads + verifies binaries, sets +x
```

Gitignore the binaries (large + non-source). Check in `MANIFEST.json`, the fetch script, and the license text. CI / a fresh clone runs `node scripts/fetch-ffmpeg.mjs` to populate `resources/ffmpeg/`.

### Manifest (filled in during Phase 2)

| Arch | Version | Source URL | SHA-256 (ffmpeg) | SHA-256 (ffprobe) | License |
|---|---|---|---|---|---|
| `darwin-arm64` | _TBD_ | _TBD_ | _TBD_ | _TBD_ | LGPL-2.1+ |
| `darwin-x64` | _TBD_ | _TBD_ | _TBD_ | _TBD_ | LGPL-2.1+ |

Update this table when Phase 2 lands. If the row is empty, the build is not ready to ship.

### Path resolution

Centralise in `electron/ffmpeg-paths.js`:

```js
function resolveFfmpeg() {
  if (process.env.CONCAT_FFMPEG) return process.env.CONCAT_FFMPEG;
  if (app.isPackaged) {
    return path.join(process.resourcesPath, "ffmpeg", `${process.platform}-${process.arch}`, "ffmpeg");
  }
  return path.join(__dirname, "..", "resources", "ffmpeg", `${process.platform}-${process.arch}`, "ffmpeg");
}
```

Same for `ffprobe`. **Never fall back to `PATH` in `app.isPackaged`.** In dev, `PATH` fallback is acceptable if `CONCAT_FFMPEG` is unset and the bundled resource is missing, but warn loudly.

Refactor `tools/corpus-builder/index.ts` to accept these paths via an environment variable or CLI flag (`--ffmpeg-path`, `--ffprobe-path`) rather than hardcoding `"ffmpeg"`. The main process passes them when spawning the builder child.

### Self-check on launch

```js
const out = await execFile(resolveFfprobe(), ["-version"], { timeout: 5000 });
if (!/ffprobe version/.test(out.stdout)) throw new Error("ffprobe self-check failed");
```

If it fails: show a non-dismissable dialog explaining the install is corrupted and offer a "Quit" button. The corpus-builder UI must not be enabled until the self-check passes.

---

## 6. Code signing + notarization

User-supplied env vars (document in this file, never commit):

```
APPLE_ID=marcscullymail@gmail.com
APPLE_APP_SPECIFIC_PASSWORD=<app-specific password from appleid.apple.com>
APPLE_TEAM_ID=<10-char team id>
CSC_LINK=<path to .p12 or keychain identity>
CSC_KEY_PASSWORD=<p12 password>
```

`electron-builder` config (in `package.json` or `electron-builder.yml`):

```yaml
appId: com.marcscully.concatenative-av
productName: Concatenative AV
mac:
  category: public.app-category.music
  target:
    - target: dmg
      arch:
        - arm64
        - x64
  hardenedRuntime: true
  gatekeeperAssess: false
  entitlements: build/entitlements.mac.plist
  entitlementsInherit: build/entitlements.mac.plist
  notarize:
    teamId: ${env.APPLE_TEAM_ID}
  extraResources:
    - from: resources/ffmpeg/${arch}
      to: ffmpeg/${platform}-${arch}
      filter: ["**/*"]
```

`build/entitlements.mac.plist` — minimum viable set:

```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>com.apple.security.cs.allow-jit</key>
  <true/>
  <key>com.apple.security.cs.allow-unsigned-executable-memory</key>
  <true/>
  <key>com.apple.security.cs.disable-library-validation</key>
  <true/>
  <key>com.apple.security.files.user-selected.read-only</key>
  <true/>
  <key>com.apple.security.files.user-selected.read-write</key>
  <true/>
</dict>
</plist>
```

Notes:

- `allow-jit` is required by V8.
- `allow-unsigned-executable-memory` and `disable-library-validation` are usually required by Electron because of how its helper processes load frameworks. Re-evaluate before v2 — these are blunt entitlements.
- We do **not** enable App Sandbox in v1 because we spawn child processes (`ffmpeg`, `node server.js`) outside the app bundle's signed boundary. Sandboxing is a v2 hardening task.

### Signing helper binaries

`ffmpeg` and `ffprobe` must be signed during the codesign step or notarization will fail. Add to electron-builder config:

```yaml
mac:
  binaries:
    - resources/ffmpeg/darwin-arm64/ffmpeg
    - resources/ffmpeg/darwin-arm64/ffprobe
    - resources/ffmpeg/darwin-x64/ffmpeg
    - resources/ffmpeg/darwin-x64/ffprobe
```

After build, verify:

```sh
codesign --verify --deep --strict /Applications/Concatenative\ AV.app
spctl --assess -vv /Applications/Concatenative\ AV.app
```

Both must return clean.

---

## 7. License + attribution

User-decided. Until then, mark this section TBD. Required before any sale:

- Top-level `LICENSE` file in the repo for the application's own source.
- `THIRD_PARTY_LICENSES.md` enumerating FFmpeg, Electron, Chromium, Node, and any npm dependencies. Include the FFmpeg license text under `resources/ffmpeg/LICENSE.ffmpeg.txt` shipped inside the bundle.
- About panel surfaces "Powered by FFmpeg" with a link to https://ffmpeg.org and the LGPL notice (LGPL requires attribution).

---

## 8. Security checklist (Phase 1 + Phase 4)

- `webPreferences.contextIsolation: true`
- `webPreferences.nodeIntegration: false`
- `webPreferences.sandbox: true` (or `false` only if a preload limitation forces it — document why)
- `webPreferences.webSecurity: true`
- `webPreferences.allowRunningInsecureContent: false`
- `webPreferences.experimentalFeatures: false`
- `BrowserWindow` opens with `setMenuBarVisibility(false)` (we set a custom menu) and disables `webContents.setWindowOpenHandler` to deny `window.open` from the renderer.
- All preload IPC handlers validate inputs (regex on names, path resolution, existence checks) before acting.
- The renderer loads only `http://127.0.0.1:<port>` (our server) and no external URLs. If you ever add a "Buy a license" button, open it via `shell.openExternal`, not in a Chromium window.

Run the `security-review` skill before any signed release.

---

## 9. What's deliberately not in this spec

- Auto-updates (electron-updater) — v2.
- License activation — v2.
- Windows / Linux builds — v2.
- A custom protocol handler (e.g. `concatenative-av://open?corpus=…`) — v2.
- Multi-window — v2.
- Crash reporting — v2.

If a v1 task accidentally adds any of these, remove it and note it in the v2 backlog inside `PLAN.md`.
