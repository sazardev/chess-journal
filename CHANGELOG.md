# Changelog

All notable changes to Chess Journal are documented here.
The format is based on [Keep a Changelog](https://keepachangelog.com/),
and this project adheres to [Semantic Versioning](https://semver.org/).

## [Unreleased]

## [0.1.14] - 2026-06-11

## [0.1.13] - 2026-06-11

## [0.1.12] - 2026-06-11

## [0.1.11] - 2026-06-11

### Added
- **Puzzles** — a new exercise mode in the Library (its own tab; the drawer is wider on desktop). A bank of classic checkmate puzzles (mate in one, two or three) drawn from famous games — Morphy's Opera Mate, the Immortal, the Evergreen, Légal's Mate, Fischer's "Game of the Century" — plus fundamental mating patterns. Solve them on the usual board (drag or click) with immediate right/wrong feedback as the opponent answers; each shows its objective and side to move, with no move hints.
- Puzzle tracking — a live timer, mistake counter and step counter while solving; solved puzzles are marked, and your best time, fewest mistakes and "clean" (no-mistake) solves are saved. Filter the list by difficulty or solved / unsolved.
- Engine presets — pick Eco, Fast, Balanced, Deep or Max to trade speed for strength; live analysis and the whole-game scan use the preset's threads, hash, lines and depth, and the choice is remembered.
- Friendlier default game names — new games are named after tournaments and chess motifs (Tata Steel, Zugzwang, Greek Gift…) instead of "Untitled".

## [0.1.10] - 2026-06-10

## [0.1.9] - 2026-06-10

### Added
- Mobile Settings page (a 4th bottom-nav item) holding version/updates, data management and the shortcut reference — moved off the title bar.
- Contextual mobile app bar: opening Library or Settings shows a back arrow and the section name instead of the game title.

### Changed
- The Library now opens full-screen on mobile (it was a cramped drawer), with the Classics catalog, search and filters fully visible; opening it no longer pops up the keyboard.
- On mobile the title bar shows only the title; version/settings/shortcuts live on the Settings page.

### Fixed
- The move-input bar now lifts above the on-screen keyboard (Android `adjustResize` + `interactive-widget`), and the bottom nav hides while typing — the field is no longer covered.
- Android APKs strip native debug symbols, shrinking the universal APK from ~130 MB/ABI so it installs on storage-constrained devices and emulators.
- The CI emulator step runs from a single script so the APK path survives to the install/launch/screenshot commands.

## [0.1.8] - 2026-06-10

### Added
- Mobile bottom navigation (Moves · Analysis · Library) and swipe left/right on the board to step through moves — a more native Android feel.
- CI boots an Android emulator, installs the APK, launches the app and uploads a screenshot for verification.

## [0.1.7] - 2026-06-10

### Added
- Android launcher icon (the bishop) instead of the default Tauri logo.
- App metadata / SEO — description, keywords, theme-color, Open Graph and mobile-web-app tags; `viewport-fit=cover`.

### Changed
- Mobile/native pass: desktop window controls are hidden on touch devices, safe-area insets are respected (status & navigation bars), row actions stay visible on touch (no hover needed), and rubber-band scroll / double-tap zoom are disabled for a more native Android feel.

## [0.1.6] - 2026-06-10

## [0.1.5] - 2026-06-10

### Added
- Big local game bank — ~930 real games from 60+ chess legends across every era (Morphy, Capablanca, Alekhine, Fischer, Kasparov, Karpov, Carlsen, Caruana, Ding, Firouzja…) plus famous games (Kasparov–Deep Blue, WCC 2023). Built by `scripts/build-classics-pgn.mjs` from public PGN collections; opening names derived from the ECO base; loaded lazily.

### Changed
- Classics search now matches player first names too — search "magnus", "bobby", "garry", "vishy"…
- The Classics bank loads on demand (kept out of the initial bundle).

## [0.1.4] - 2026-06-10

### Added
- Richer Classics screen — each game shows its opening (ECO + name), players with ELO, move count, level, category (Bullet / Blitz / Classic…) and result, with search and category filters. Added the Elephant Trap (Queen's Gambit Declined).
- `node scripts/fetch-classics.mjs` — pull hundreds of real games (Carlsen, bullet, your favourite openings) from Lichess straight into the Classics library, with opening, ELO and time control.

## [0.1.3] - 2026-06-10

### Added
- Classics — a bundled library of legendary games (Opera, Immortal, Evergreen, Game of the Century, Légal's Mate). New "Classics" tab in the library; loading one is a preview that never clutters your own games.

### Changed
- Decluttered the panel: only Analyze stays out front; annotations (arrow/mark), Export PNG and the opening-detection toggle moved into Advanced (detection stays on by default). History header is clean.
- Long games: the current move now scrolls into view as you navigate or play.

## [0.1.2] - 2026-06-10

### Added
- Opening detection — bundled ECO database (offline) names the opening as you play, with an "out of book" marker. Toggle in the History header.
- Per-opening stats — your games are auto-tagged by opening; a Stats view shows games, W/L/D (set result + your color in a game's Advanced panel) and where you leave theory. Click an opening to filter the library.

## [0.1.1] - 2026-06-10

### Added
- First-run onboarding — a welcome screen (in the app's own UI) showing the version, what Chess Journal is, key shortcuts and the changes to consider. Reappears after each update.
- Branded Windows installer — bishop sidebar graphic and a welcome/changes page shown during setup.

## [0.1.0]

### Added
- Continuous autosave — every game with moves lives in the library and updates on each change.
- Save status indicator and `Ctrl+S` manual save.
- Favorites (♥) separate from pinned (★), with independent library filters.
- Settings panel for data management (empty library, clear autosave, erase everything).
- Engine analysis with a coherent, cleaner heatmap and candidate list.
- Move-quality marks (!!, !, ?!, ?, ??) in the move history, plus a one-shot whole-game analyzer.
- Move-input autocomplete with legal-move suggestions and live eval hints.
- Advanced panel: editable metadata (rating, tags, notes) and export/import (FEN, PGN, JSON).
- Responsive layout for desktop, tablet and small screens; keyboard shortcuts overlay (`?`).
- Version display in the title bar, in-app changelog, and automatic update checking.

### Changed
- Unified the New / Save flows into a single coherent model.
- Refreshed the app icon (bishop) and overall visual polish.
