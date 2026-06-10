<div align="center">

<img src="src-tauri/icons/128x128.png" width="84" alt="Chess Mini" />

# Chess Mini

**A fast, minimalist desktop app to record, analyze and review your chess games.**

[![Release](https://img.shields.io/github/v/release/sazardev/chess-mini?style=flat-square&label=release)](https://github.com/sazardev/chess-mini/releases/latest)
[![Build](https://img.shields.io/github/actions/workflow/status/sazardev/chess-mini/release.yml?style=flat-square&label=build)](https://github.com/sazardev/chess-mini/actions/workflows/release.yml)
[![Downloads](https://img.shields.io/github/downloads/sazardev/chess-mini/total?style=flat-square)](https://github.com/sazardev/chess-mini/releases)
![Platform](https://img.shields.io/badge/platform-Windows-black?style=flat-square)

### [⬇ Download the latest installer](https://github.com/sazardev/chess-mini/releases/latest)

</div>

---

Chess Mini is built for people who already play chess and like a clean,
keyboard-first tool — engine analysis, move-quality marks, annotations and a
searchable game library, with everything saved automatically.

## Features

- **Continuous autosave** — every game with moves lives in the library and updates on each move; nothing to remember.
- **Engine analysis** — Stockfish eval bar, best line, candidate moves and a clean, coherent heatmap.
- **Move-quality marks** — `!! ! ?! ? ??` in the move list, live as you browse or via a one-shot whole-game analyzer.
- **Move input with autocomplete** — type SAN with legal-move suggestions and live eval hints.
- **Library** — search, sort, favorites (♥) and pins (★), with quick load.
- **Annotations** — arrows, highlights, bookmarks and per-move comments.
- **Import / export** — FEN, PGN and JSON; export the board as PNG.
- **Responsive** — tuned for desktop, tablet and small windows.
- **Auto-updates** — checks GitHub on launch and updates itself in one click.

## Keyboard shortcuts

| Action | Keys | | Action | Keys |
| --- | --- | --- | --- | --- |
| Prev / next move | `←` `→` | | Save now | `Ctrl S` |
| Start / end | `Ctrl Home` `Ctrl End` | | New game | `Ctrl N` |
| Play / pause | `Space` | | Toggle favorite | `Ctrl D` |
| Flip board | `Ctrl B` | | Toggle library | `Ctrl L` |
| Arrow / mark mode | `Ctrl A` `Ctrl M` | | Settings | `Ctrl ,` |
| Focus move input | `Ctrl I` | | Shortcuts | `?` |

Press `?` in the app for the full list.

## Tech stack

[Tauri 2](https://v2.tauri.app/) · [React 19](https://react.dev/) · TypeScript ·
[Zustand](https://github.com/pmndrs/zustand) · [chess.js](https://github.com/jhlywa/chess.js) ·
[Stockfish](https://stockfishchess.org/) · [Tailwind CSS](https://tailwindcss.com/)

## Development

```bash
npm install
npm run tauri dev      # run the desktop app (hot reload)
npm run dev            # or just the web frontend
npm run build          # typecheck + build the frontend
npm run lint
```

## Building & releasing

Releases are produced by the **Release** GitHub Action (Windows NSIS installer +
signed auto-update manifest). To cut one: **Actions → Release → Run workflow** and
pick a version bump. See [`RELEASING.md`](RELEASING.md) for the full process and the
one-time signing-key setup.

## License

Not yet specified.
