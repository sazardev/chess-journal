# Releasing Chess Mini

Chess Mini ships as a Windows installer (NSIS, per-user — no admin needed) and
updates itself automatically via the Tauri updater. Releases are produced by the
**Release** GitHub Action.

---

## One-time setup (signing keys)

The auto-updater only installs updates signed with the project's private key. A
keypair was already generated at `./.tauri/` (git-ignored):

- `./.tauri/chess-mini.key` — **private key** (never commit; treat as a secret)
- `./.tauri/chess-mini.key.pub` — public key (already embedded in `src-tauri/tauri.conf.json` → `plugins.updater.pubkey`)

Add two repository secrets in **GitHub → Settings → Secrets and variables → Actions**:

| Secret | Value |
| --- | --- |
| `TAURI_SIGNING_PRIVATE_KEY` | the full contents of `./.tauri/chess-mini.key` |
| `TAURI_SIGNING_PRIVATE_KEY_PASSWORD` | empty (the key was generated without a password) |

To print the private key:

```powershell
Get-Content .\.tauri\chess-mini.key -Raw
```

> Prefer your own password-protected key? Regenerate and re-embed the public key:
> ```powershell
> npx tauri signer generate -w .\.tauri\chess-mini.key -f
> Get-Content .\.tauri\chess-mini.key.pub -Raw   # paste into tauri.conf.json → plugins.updater.pubkey
> ```
> Then update both secrets accordingly.

> These secrets are **required**: `createUpdaterArtifacts` signs the installer during
> the build, so a release will fail without `TAURI_SIGNING_PRIVATE_KEY`. (To ship
> unsigned installers without auto-update, set `createUpdaterArtifacts` to `false`
> in `src-tauri/tauri.conf.json` and drop the `plugins.updater` block.)

---

## Cut a release

### Automatic (default) — just push to `master`
Every push to `master` that touches app code **auto-releases a new patch version**:
the workflow bumps `0.1.x → 0.1.(x+1)`, updates `CHANGELOG.md`, commits, tags, builds,
signs, and publishes the GitHub Release with the installer + `latest.json`.

Considerations baked in so it stays clean:
- **Docs/CI-only pushes don't release** — changes limited to `**.md`, `LICENSE`,
  `.gitignore`, `.github/**` or `app-icon.svg` are ignored.
- **No loops** — the bot's `chore: release …` commit is skipped (and is pushed with
  `GITHUB_TOKEN`, which never re-triggers workflows).
- **Escape hatch** — put `[skip release]` anywhere in the commit message to skip.
- **Serialized** — a `concurrency` group ensures only one release runs at a time.

### Manual — pick the bump
**Actions → Release → Run workflow**, choose `none` / `patch` / `minor` / `major`.
Use `minor` / `major` for bigger releases, or `none` to re-release the current version.

Version is kept in sync across `package.json`, `src-tauri/tauri.conf.json`,
`src-tauri/Cargo.toml` and `CHANGELOG.md` by `scripts/bump-version.mjs`.

---

## How auto-update works

1. On launch the app calls the updater, which fetches
   `https://github.com/sazardev/chess-mini/releases/latest/download/latest.json`.
2. If a newer signed version exists, a dot appears on the version chip next to
   **Chess Mini** in the title bar.
3. Clicking the version opens **About**, where the user can **Update & restart** —
   the new version downloads, verifies its signature, installs, and relaunches.

---

## Build / test locally

```powershell
npm install
npm run tauri dev      # run the desktop app
npm run tauri build    # produce the installer in src-tauri/target/release/bundle/nsis
```

> A local `tauri build` signs updater artifacts and therefore needs the signing key.
> Set it for the session:
> ```powershell
> $env:TAURI_SIGNING_PRIVATE_KEY = Get-Content .\.tauri\chess-mini.key -Raw
> $env:TAURI_SIGNING_PRIVATE_KEY_PASSWORD = ""
> npm run tauri build
> ```

---

## Populate the Classics library

The "Classics" tab is fed by `src/data/classics-modern.json` (loaded lazily) plus
the curated historic games in `src/data/classics.ts`.

- **Rebuild the bank from GitHub PGN collections** (legends + famous games — works
  anywhere GitHub is reachable):
  ```bash
  node scripts/build-classics-pgn.mjs   # edit PLAYERS / caps in the script
  ```
- **Add live games from Lichess** (Carlsen, bullet, specific players) — run on a
  network that can reach lichess.org:
  ```bash
  node scripts/fetch-classics.mjs       # edit SPECS in the script
  ```

Either writes `src/data/classics-modern.json`. Commit it and the next release ships
the games. Validate hand-authored games in `classics.ts` with
`node scripts/validate-classics.mjs`.

## Android (APK)

Chess Mini also builds for Android (Tauri mobile). The UI is already responsive,
and desktop-only plugins (auto-update, relaunch) are gated off mobile.

- **Build an installable APK:** **Actions → Android APK → Run workflow**. It sets up
  the Android SDK/NDK, runs `tauri android init` + `tauri android build --apk --debug`
  (arm64, debug-signed so it installs without a keystore) and uploads the APK as an
  artifact. Download it and sideload onto your phone.
- **Locally** (needs Android Studio / SDK + NDK, `NDK_HOME` set):
  ```bash
  npm run tauri android init
  npm run tauri android dev      # run on a device/emulator
  npm run tauri android build --apk --debug
  ```
- A Play Store **release** APK/AAB needs a signing keystore (set `tauri.conf.json`
  → `bundle.android.signing` or sign the AAB) — out of scope for the debug build.

## Regenerate the app icon

The icon source is `app-icon.svg` (a bishop). To regenerate every size:

```powershell
npx tauri icon .\app-icon.svg
```
