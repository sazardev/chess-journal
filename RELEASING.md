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

Without these secrets the workflow still builds and publishes a working installer —
only the silent auto-update step is skipped.

---

## Cut a release

### Option A — from GitHub (recommended)
**Actions → Release → Run workflow**, pick a version bump (`patch` / `minor` / `major`),
and run. The workflow bumps the version everywhere, updates `CHANGELOG.md`, commits,
tags `vX.Y.Z`, builds the installer, signs it, and publishes the GitHub Release with
the installer + `latest.json` (the updater manifest).

### Option B — from your machine
```powershell
node scripts/bump-version.mjs patch     # or minor / major / an explicit 1.2.3
git add -A
git commit -m "chore: release v$(node -p "require('./package.json').version")"
git tag "v$(node -p "require('./package.json').version")"
git push --follow-tags
```
Pushing the `v*` tag triggers the same Release workflow.

Version is kept in sync across `package.json`, `src-tauri/tauri.conf.json` and
`src-tauri/Cargo.toml` by `scripts/bump-version.mjs`.

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

## Regenerate the app icon

The icon source is `app-icon.svg` (a bishop). To regenerate every size:

```powershell
npx tauri icon .\app-icon.svg
```
