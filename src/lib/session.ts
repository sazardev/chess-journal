import type { SaveData, GameResult } from "../types/save"
import { useGameStore, START_FEN } from "../stores/useGameStore"
import { useBoardStore } from "../stores/useBoardStore"
import { useMetaStore } from "../stores/useMetaStore"
import { useLibraryStore } from "../stores/useLibraryStore"
import { useSaveStore } from "../stores/useSaveStore"
import { usePersistenceStore } from "../stores/usePersistenceStore"
import { useAnalysisStore } from "../stores/useAnalysisStore"
import { useEditorStore } from "../stores/useEditorStore"
import { getOpeningsCache, detectOpening } from "./openings"

// Re-exported for backwards compatibility; defined in its own module to avoid
// an import cycle with useMetaStore (which seeds new games with a random name).
export { randomGameName } from "./gameNames"

/**
 * Single source of truth for the "auto a biblioteca" save model.
 * Every game with at least one move lives in the library and is updated
 * in place on every change. `currentLibraryId` links the working game to
 * its library entry.
 */

function uid(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7)
}

// Auto-detect the objective result from a checkmating final move (draws stay manual).
function autoResult(fullHistory: SaveData["game"]["fullHistory"]): GameResult | undefined {
  const last = fullHistory[fullHistory.length - 1]
  if (last && last.san.includes("#")) return last.color === "w" ? "1-0" : "0-1"
  return undefined
}

export function buildSaveData(): SaveData {
  const g = useGameStore.getState()
  const b = useBoardStore.getState()
  const meta = useMetaStore.getState().snapshot()

  // Auto-tag the opening (from the cached ECO map) and result, without
  // overwriting anything the user set explicitly.
  const map = getOpeningsCache()
  // Opening detection only makes sense for games from the standard start.
  if (map && g.fullHistory.length > 0 && g.startFen === START_FEN) {
    const opening = detectOpening(g.fullHistory, map)
    if (opening) meta.opening = { eco: opening.eco, name: opening.name, ply: opening.lastBookPly }
  }
  if (!meta.result || meta.result === "*") {
    const auto = autoResult(g.fullHistory)
    if (auto) meta.result = auto
  }

  return {
    version: 1,
    meta,
    game: {
      startFen: g.startFen,
      fullHistory: g.fullHistory,
      historyIndex: g.historyIndex,
      orientation: g.orientation,
      bookmarks: g.bookmarks,
      comments: g.comments,
      isPlaying: g.isPlaying,
      playSpeed: g.playSpeed,
      currentLibraryId: g.currentLibraryId,
    },
    board: {
      arrows: b.arrows.map((a) => ({ from: a.from, to: a.to, color: a.color })),
      highlights: { ...b.highlights },
      annotationHistory: b.annotationHistory.map((a) =>
        a.type === "arrow"
          ? { type: "arrow" as const, from: a.from, to: a.to }
          : { type: "highlight" as const, square: a.square },
      ),
    },
  }
}

/**
 * Upsert the working game into the library. Generates and assigns a stable
 * id synchronously (before the async write) so rapid consecutive saves can
 * never create duplicate entries. Returns the entry id, or null when the
 * game has no moves yet.
 */
export function commitToLibrary(): string | null {
  const g = useGameStore.getState()
  // Saveable once there's a move, or a custom (editor) starting position.
  const hasCustomStart = g.startFen !== START_FEN
  if (g.fullHistory.length < 1 && !hasCustomStart) return null

  let id = g.currentLibraryId
  if (!id) {
    id = uid()
    g.setCurrentLibraryId(id)
  }

  void useLibraryStore.getState().addEntry(buildSaveData(), id)
  return id
}

let idleTimer: ReturnType<typeof setTimeout> | undefined

/** Flash the "Saved" indicator, then fade back to idle. */
export function flashSaved() {
  useSaveStore.getState().markSaved()
  if (idleTimer) clearTimeout(idleTimer)
  idleTimer = setTimeout(() => useSaveStore.getState().markIdle(), 1500)
}

/** Persist everywhere right now and flash the indicator (Ctrl+S / autosave flush). */
export async function saveNow(): Promise<void> {
  commitToLibrary()
  try {
    await usePersistenceStore.getState().writeAutosave(buildSaveData())
  } catch {
    /* ignore — persistence is best-effort */
  }
  flashSaved()
}

/** Archive the current game (already saved) and open a blank board. */
export function newGame() {
  commitToLibrary()
  useEditorStore.getState().exit()

  const orientation = useGameStore.getState().orientation
  useMetaStore.getState().reset()
  useGameStore.getState().reset()
  useGameStore.setState({ orientation }) // keep board orientation across New
  useBoardStore.getState().clearAll()
  useAnalysisStore.getState().clear()

  if (idleTimer) clearTimeout(idleTimer)
  useSaveStore.getState().markIdle()
}

/**
 * Open the position editor seeded from the current game's position, so you can
 * rearrange the pieces of the game you already have open. Commits first so the
 * current game is safely in the library.
 */
export function openEditor() {
  commitToLibrary()
  useEditorStore.getState().enter(useGameStore.getState().fen)
}

/**
 * Save the editor's position into the current game (same library entry): it
 * becomes the game's starting position. The game then plays, analyzes, saves,
 * and exports through the normal flow. Resets the move list, keeps name/tags.
 */
export function saveEditorPosition(fen: string, orientation: "white" | "black") {
  useEditorStore.getState().exit()
  useGameStore.getState().setStartPosition(fen)
  useGameStore.setState({ orientation })
  useBoardStore.getState().clearAll()
  useAnalysisStore.getState().clear()
  void saveNow()
}

/** Toggle favorite on the working game's library entry (saving first if needed). */
export function toggleCurrentFavorite() {
  const id = commitToLibrary()
  if (id) void useLibraryStore.getState().toggleFavorite(id)
}
