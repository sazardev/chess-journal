/**
 * Cache of generated LLM commentary, persisted to disk (`ai-cache.json`) so a
 * game's analysis survives navigation AND app restarts — never regenerated once
 * seen. Keyed by model + position, so it's coherently tied to a game's moves
 * (any session reaching the same position/move reuses the comment).
 */

import { create } from "zustand"
import { load } from "@tauri-apps/plugin-store"
import { posKey } from "./useAnalysisStore"

interface AiCacheState {
  moves: Record<string, string>
  games: Record<string, string>
  loaded: boolean
  init: () => Promise<void>
  setMove: (key: string, text: string) => void
  setGame: (key: string, text: string) => void
  clear: () => void
}

let store: Awaited<ReturnType<typeof load>> | null = null
async function ensureStore() {
  if (!store) store = await load("ai-cache.json")
  return store
}
async function persist(field: "moves" | "games", value: Record<string, string>) {
  try {
    const st = await ensureStore()
    await st.set(field, value)
    await st.save()
  } catch {
    /* not under Tauri (dev/test) or write failed — best effort */
  }
}

export const useAiCacheStore = create<AiCacheState>((set, get) => ({
  moves: {},
  games: {},
  loaded: false,

  init: async () => {
    try {
      const st = await ensureStore()
      const moves = (await st.get<Record<string, string>>("moves")) ?? {}
      const games = (await st.get<Record<string, string>>("games")) ?? {}
      set({ moves, games, loaded: true })
    } catch {
      set({ loaded: true })
    }
  },

  setMove: (key, text) => {
    set((s) => ({ moves: { ...s.moves, [key]: text } }))
    persist("moves", get().moves)
  },
  setGame: (key, text) => {
    set((s) => ({ games: { ...s.games, [key]: text } }))
    persist("games", get().games)
  },
  clear: () => {
    set({ moves: {}, games: {} })
    persist("moves", {})
    persist("games", {})
  },
}))

/** Cache key for a single-move comment (model + the move played from a position). */
export function moveCacheKey(modelId: string, beforeFen: string, lan: string): string {
  return `${modelId}|${posKey(beforeFen)}|${lan}`
}

/** Cache key for a game review (model + move sequence + how much was analyzed). */
export function gameCacheKey(modelId: string, lans: string[], coveredPlies: number): string {
  return `${modelId}|${lans.join("")}|${coveredPlies}`
}
