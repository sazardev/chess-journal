import type { SaveData, GameResult } from "../types/save"
import { useGameStore } from "../stores/useGameStore"
import { useBoardStore } from "../stores/useBoardStore"
import { useMetaStore } from "../stores/useMetaStore"
import { useLibraryStore } from "../stores/useLibraryStore"
import { useSaveStore } from "../stores/useSaveStore"
import { usePersistenceStore } from "../stores/usePersistenceStore"
import { useAnalysisStore } from "../stores/useAnalysisStore"
import { getOpeningsCache, detectOpening } from "./openings"

/**
 * Single source of truth for the "auto a biblioteca" save model.
 * Every game with at least one move lives in the library and is updated
 * in place on every change. `currentLibraryId` links the working game to
 * its library entry.
 */

function uid(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7)
}

const GAME_NAMES = [
  "Tata Steel",
  "Candidates Tournament",
  "Sinquefield Cup",
  "Norway Chess",
  "London Chess Classic",
  "Wijk aan Zee",
  "Gibraltar Masters",
  "Isle of Man",
  "World Rapid",
  "World Blitz",
  "En Passant",
  "Zugzwang",
  "J'adoube",
  "The Queen's Gambit",
  "Knightmare",
  "Fork You",
  "Pinned Piece",
  "Blunderville",
  "Smothered Mate",
  "King's Indian Retreat",
  "Sicilian Scheming",
  "Evans Gambit Gone Wrong",
  "Magnus'd",
  "Hikaru'd",
  "Old Benoni",
  "Hyperaccelerated Something",
  "Double Bongcloud",
  "Scholar's Mate Attempt",
  "Touch Move",
  "Hastings Masters",
  "Capablanca Memorial",
  "Linares Tournament",
  "Alekhine Memorial",
  "Tal Memorial",
  "Bobby Fischer's Dream",
  "Karpov–Kasparov Era",
  "Sunday Blitz",
  "Café de la Régence",
  "Reykjavik 1972",
  "Buenos Aires Olympiad",
  "Central Park Bullet",
  "Petrov's Immortal",
  "Opera Game",
  "Fried Liver Attack",
  "Poisoned Pawn",
  "Greek Gift",
  "Windmill",
  "Philidor's Legacy",
  "Morphy's Opera",
  "Dragon Variation",
  "Najdorf Poison",
  "Mar del Plata",
  "Trompowsky Attack",
  "Latvian Gambit",
  "Berlin Defense",
  "Reggio Emilia",
  "Bundesliga Weekender",
  "Zurich 1953",
  "Moscow 1946",
  "Saint Louis Rapid",
  "Dortmund Sparkassen",
  "Shamkir Chess",
  "Grand Swiss",
  "Bullet Brawl",
  "Titled Tuesday",
  "Arena Kings",
]

export function randomGameName(): string {
  return GAME_NAMES[Math.floor(Math.random() * GAME_NAMES.length)]
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
  if (map && g.fullHistory.length > 0) {
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
  if (g.fullHistory.length < 1) return null

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

  const orientation = useGameStore.getState().orientation
  useMetaStore.getState().reset()
  useGameStore.getState().reset()
  useGameStore.setState({ orientation }) // keep board orientation across New
  useBoardStore.getState().clearAll()
  useAnalysisStore.getState().clear()

  if (idleTimer) clearTimeout(idleTimer)
  useSaveStore.getState().markIdle()
}

/** Toggle favorite on the working game's library entry (saving first if needed). */
export function toggleCurrentFavorite() {
  const id = commitToLibrary()
  if (id) void useLibraryStore.getState().toggleFavorite(id)
}
