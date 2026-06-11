# AGENTS.md — Chess Journal

## Dev commands

```bash
npm run dev              # Vite dev server (web only, no Tauri)
npm run tauri dev        # Tauri desktop app with hot reload
npm run build            # tsc -b (typecheck) then vite build
npm run lint             # eslint .
npm run tauri build      # Produce Windows installer (needs signing key env vars)
```

No test suite is configured. There is no `npm test`.

## Architecture

- **Tauri 2** desktop app (Windows NSIS) with Android mobile support via Tauri mobile.
- **React 19 + TypeScript + Zustand + Tailwind CSS v4** for the frontend.
- **The Rust backend has zero custom commands.** `src-tauri/src/lib.rs` only initializes plugins (dialog, fs, store, updater, process). All application logic lives in TypeScript.
- **Stockfish** runs in a Web Worker (`public/stockfish-engine.js` + `.wasm`).
- **Persistence** has two paths: Tauri FS (`@tauri-apps/plugin-fs`) on desktop, `localStorage` as fallback. Resolved at runtime in `usePersistenceStore`. Keys are prefixed `chess-journal-`.
- **Fonts**: General Sans (api.fontshare.com), JetBrains Mono (Google Fonts). CSP in `tauri.conf.json` allows these origins.

## Key files

| Path | Role |
|------|------|
| `src/App.tsx` | Root component — wires all hooks, modals, keyboard shortcuts |
| `src/lib/session.ts` | "Auto a biblioteca" save model — builds `SaveData`, saves to library |
| `src/stores/useGameStore.ts` | Core game state (fen, history, chess.js instance) |
| `src/stores/usePersistenceStore.ts` | Read/write autosave + library (FS or localStorage) |
| `src/stores/useLibraryStore.ts` | Game library entries (pin, favorite, search) |
| `src/hooks/useEngine.ts` | Stockfish worker lifecycle + eval state |
| `src/hooks/useKeyboard.ts` | Global keyboard shortcut handler |
| `src/data/openings.json` | ECO database, lazy-loaded as a chunk |
| `src/data/classics.ts` + `classics-modern.json` | Pre-loaded classic games |

## TypeScript quirks

- `verbatimModuleSyntax: true` — must use `import type` for type-only imports.
- `erasableSyntaxOnly: true` — no `enum` or `namespace`. Use string unions.
- `noUnusedLocals` and `noUnusedParameters` are on.
- `__APP_VERSION__` is injected by Vite at build time (from `package.json`), declared in `vite-env.d.ts`.

## Tailwind CSS v4

Uses the `@tailwindcss/vite` plugin (not PostCSS). Theme configured via `@theme` block in `src/index.css`. No `tailwind.config.js`.

## State management

All stores are Zustand (`create()`) in `src/stores/use*Store.ts`. Stores talk to each other via `.getState()` on the import (not through React context). No provider wrapper needed.

## Release process

- Every push to `master` that touches app code auto-releases a **patch** bump via GitHub Actions. CI-only/docs-only commits are skipped.
- `[skip release]` in a commit message opts out.
- Manual release: **Actions → Release → Run workflow**, choose bump level.
- `scripts/bump-version.mjs` syncs version across `package.json`, `src-tauri/tauri.conf.json`, `src-tauri/Cargo.toml`, and `CHANGELOG.md`.
- See `RELEASING.md` for signing key setup.

## Mobile / Android

- The UI is responsive and built for both desktop and small screens.
- Android builds use `tauri android build --apk --debug`. CI workflow is `android.yml`.
- Desktop-only plugins (updater, process) are gated with `#[cfg(desktop)]` in `lib.rs` and in `capabilities/desktop.json`.

## Data scripts

```bash
node scripts/build-classics-pgn.mjs   # Rebuild classics-modern.json from GitHub PGNs
node scripts/fetch-classics.mjs        # Fetch live Lichess games
node scripts/validate-classics.mjs     # Validate hand-authored classics.ts
node scripts/build-openings.mjs        # Build openings.json from a PGN-based ECO source
```
