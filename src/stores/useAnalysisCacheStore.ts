/**
 * Persisted cache of full-game engine analysis (the `byFen` evals produced by
 * "Analyze game"), keyed by ENGINE PRESET + start position + move sequence. So
 * reopening a game shows its analysis instantly and re-running Analyze is a no-op
 * — but only when nothing that affects the result changed (different preset or a
 * different move sequence → different key → fresh analysis, never a stale mix).
 *
 * Bounded to the most recent games so the file doesn't grow without limit.
 */

import { create } from "zustand"
import { createSettingsStorage, type SettingsStorage } from "../lib/settingsStorage"
import type { PlyEval } from "../lib/moveQuality"
import { posKey } from "./useAnalysisStore"

type ByFen = Record<string, PlyEval>

interface AnalysisCacheState {
  cache: Record<string, ByFen>
  loaded: boolean
  init: () => Promise<void>
  get: (key: string) => ByFen | undefined
  put: (key: string, byFen: ByFen) => void
  clear: () => void
}

/** Keep analysis for at most this many recent (game, preset) combinations. */
const CAP = 25

let storage: SettingsStorage | null = null
async function ensureStorage() {
  if (!storage) storage = await createSettingsStorage("analysis-cache.json")
  return storage
}
async function persist(cache: Record<string, ByFen>) {
  try {
    const st = await ensureStorage()
    await st.set("cache", cache)
    await st.save()
  } catch {
    /* not under Tauri (web) or write failed — best effort */
  }
}

export const useAnalysisCacheStore = create<AnalysisCacheState>((set, get) => ({
  cache: {},
  loaded: false,

  init: async () => {
    try {
      const st = await ensureStorage()
      const cache = (await st.get<Record<string, ByFen>>("cache")) ?? {}
      set({ cache, loaded: true })
    } catch {
      set({ loaded: true })
    }
  },

  get: (key) => get().cache[key],

  put: (key, byFen) => {
    set((s) => {
      const cache = { ...s.cache }
      delete cache[key] // re-insert at the end (most-recent)
      cache[key] = byFen
      const keys = Object.keys(cache)
      while (keys.length > CAP) {
        const oldest = keys.shift()
        if (oldest) delete cache[oldest]
      }
      return { cache }
    })
    persist(get().cache)
  },

  clear: () => {
    set({ cache: {} })
    persist({})
  },
}))

/** Cache key: engine preset + start position + the exact move sequence. */
export function analysisCacheKey(preset: string, startFen: string, lans: string[]): string {
  return `${preset}|${posKey(startFen)}|${lans.join("")}`
}
