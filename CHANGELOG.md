# Changelog

All notable changes to Chess Mini are documented here.
The format is based on [Keep a Changelog](https://keepachangelog.com/),
and this project adheres to [Semantic Versioning](https://semver.org/).

## [Unreleased]

### Added
- Opening detection — bundled ECO database (offline) names the opening as you play, with an "out of book" marker. Toggle in the History header.
- Per-opening stats — your games are auto-tagged by opening; a Stats view shows games, W/L/D (set result + your color in a game's Advanced panel) and where you leave theory. Click an opening to filter the library.

## [0.1.1] - 2026-06-10

### Added
- First-run onboarding — a welcome screen (in the app's own UI) showing the version, what Chess Mini is, key shortcuts and the changes to consider. Reappears after each update.
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
