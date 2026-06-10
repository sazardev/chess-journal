import type { Move } from "chess.js"

export interface OpeningInfo {
  eco: string
  name: string
  /** Number of plies that were still part of a known opening line. */
  lastBookPly: number
}

type OpeningEntry = { eco: string; name: string; ply: number }
type OpeningMap = Record<string, OpeningEntry>

let cache: OpeningMap | null = null
let loading: Promise<OpeningMap> | null = null

/** The ECO map if already loaded, else null (for synchronous best-effort tagging). */
export function getOpeningsCache(): OpeningMap | null {
  return cache
}

/** Lazily load the bundled ECO database (kept out of the main chunk). */
export async function loadOpenings(): Promise<OpeningMap> {
  if (cache) return cache
  if (!loading) {
    loading = import("../data/openings.json").then((m) => {
      cache = ((m as { default?: OpeningMap }).default ?? m) as OpeningMap
      return cache
    })
  }
  return loading
}

function posKey(fen: string): string {
  return fen.split(" ").slice(0, 4).join(" ")
}

/**
 * Walk the move list and return the deepest known opening it passes through.
 * `lastBookPly` marks where the game left theory (out of book = next ply).
 */
export function detectOpening(history: Move[], map: OpeningMap): OpeningInfo | null {
  let best: OpeningInfo | null = null
  for (let i = 0; i < history.length; i++) {
    const after = (history[i] as Move & { after?: string }).after
    if (!after) continue
    const hit = map[posKey(after)]
    if (hit) best = { eco: hit.eco, name: hit.name, lastBookPly: i + 1 }
  }
  return best
}
