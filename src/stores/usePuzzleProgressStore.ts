import { create } from "zustand"
import { usePersistenceStore } from "./usePersistenceStore"

export interface PuzzleResult {
  /** True once the puzzle has been solved at least once. */
  solved: boolean
  /** How many times the puzzle was attempted (started). */
  plays: number
  /** Fewest wrong moves across solves (a "clean" solve is 0). */
  bestMistakes: number
  /** Fastest solve, milliseconds. */
  bestTimeMs: number
  /** Player moves in the solution. */
  steps: number
  /** True if ever solved without a single wrong move. */
  cleanSolve: boolean
  solvedAt: string
}

export type PuzzleProgress = Record<string, PuzzleResult>

interface RecordInput {
  mistakes: number
  timeMs: number
  steps: number
}

interface PuzzleProgressState {
  progress: PuzzleProgress
  loaded: boolean
  load: () => Promise<void>
  record: (id: string, r: RecordInput) => Promise<void>
  reset: () => Promise<void>
}

async function persist(progress: PuzzleProgress) {
  await usePersistenceStore.getState().writePuzzleProgress(progress)
}

export const usePuzzleProgressStore = create<PuzzleProgressState>((set, get) => ({
  progress: {},
  loaded: false,

  load: async () => {
    const store = usePersistenceStore.getState()
    if (!store.ready) return
    const progress = await store.readPuzzleProgress()
    set({ progress: progress ?? {}, loaded: true })
  },

  record: async (id, r) => {
    const prev = get().progress[id]
    const next: PuzzleResult = {
      solved: true,
      plays: (prev?.plays ?? 0) + 1,
      bestMistakes: Math.min(prev?.bestMistakes ?? Infinity, r.mistakes),
      bestTimeMs: Math.min(prev?.bestTimeMs ?? Infinity, r.timeMs),
      steps: r.steps,
      cleanSolve: (prev?.cleanSolve ?? false) || r.mistakes === 0,
      solvedAt: new Date().toISOString(),
    }
    const progress = { ...get().progress, [id]: next }
    set({ progress })
    await persist(progress)
  },

  reset: async () => {
    set({ progress: {} })
    await persist({})
  },
}))
