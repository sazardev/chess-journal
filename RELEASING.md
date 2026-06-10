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

The "Classics" tab ships with a few curated, validated historic games. To add
hundreds of real modern games (Carlsen, bullet, specific openings) with their
opening, ELO and time control, run from a network that can reach lichess.org:

```bash
node scripts/fetch-classics.mjs   # edit SPECS in the script to pick players/speeds
node scripts/validate-classics.mjs
```

It writes `src/data/classics-modern.json`. Commit it and the next release ships
the games. Hand-authored games live in `src/data/classics.ts` (validate with the
script above).

## Regenerate the app icon

The icon source is `app-icon.svg` (a bishop). To regenerate every size:

```powershell
npx tauri icon .\app-icon.svg
```
