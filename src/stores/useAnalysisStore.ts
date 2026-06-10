import { create } from "zustand"
import type { PlyEval } from "../lib/moveQuality"

interface AnalysisState {
  /** Mark Analyzer toggle (only meaningful while the engine is on). */
  markMode: boolean
  /** Cached evals keyed by position FEN. */
  byFen: Record<string, PlyEval>
  toggleMark: () => void
  setMark: (on: boolean) => void
  /** Store an eval for a position, keeping the deepest result seen. */
  record: (fen: string, e: PlyEval) => void
  clear: () => void
}

// Normalize FEN to its position fields (drop halfmove/fullmove clocks) so the
// same position always maps to the same key.
function posKey(fen: string): string {
  return fen.split(" ").slice(0, 4).join(" ")
}

export const useAnalysisStore = create<AnalysisState>((set, get) => ({
  markMode: false,
  byFen: {},

  toggleMark: () => set((s) => ({ markMode: !s.markMode })),
  setMark: (on) => set({ markMode: on }),

  record: (fen, e) => {
    const key = posKey(fen)
    const existing = get().byFen[key]
    if (existing && existing.depth >= e.depth) return
    set((s) => ({ byFen: { ...s.byFen, [key]: e } }))
  },

  clear: () => set({ byFen: {} }),
}))

export { posKey }
