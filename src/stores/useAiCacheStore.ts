/**
 * Session cache of generated LLM commentary, so revisiting a move (or reopening
 * the report) shows the analysis instantly instead of regenerating it. Keyed by
 * model + position so it's stable across navigation. In-memory only (cleared on
 * model removal); persisting across restarts would be a future addition.
 */

import { create } from "zustand"
import { posKey } from "./useAnalysisStore"

interface AiCacheState {
  moves: Record<string, string>
  games: Record<string, string>
  setMove: (key: string, text: string) => void
  setGame: (key: string, text: string) => void
  clear: () => void
}

export const useAiCacheStore = create<AiCacheState>((set) => ({
  moves: {},
  games: {},
  setMove: (key, text) => set((s) => ({ moves: { ...s.moves, [key]: text } })),
  setGame: (key, text) => set((s) => ({ games: { ...s.games, [key]: text } })),
  clear: () => set({ moves: {}, games: {} }),
}))

/** Cache key for a single-move comment (model + the move played from a position). */
export function moveCacheKey(modelId: string, beforeFen: string, lan: string): string {
  return `${modelId}|${posKey(beforeFen)}|${lan}`
}

/** Cache key for a game review (model + move sequence + how much was analyzed). */
export function gameCacheKey(modelId: string, lans: string[], coveredPlies: number): string {
  return `${modelId}|${lans.join("")}|${coveredPlies}`
}
