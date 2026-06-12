import { create } from "zustand"
import type { Nag } from "../lib/moveQuality"
import type { ExplainTone } from "../lib/explain"

export interface AssistiveFeedback {
  ply: number
  san: string
  tone: ExplainTone
  text: string
  cpLoss: number
  nag: Nag | null
  bestUci: string | null
  bestSan: string | null
}

interface AssistiveState {
  turn: "player" | "engine" | "idle"
  engineThinking: boolean
  /** Coach feedback for each player move, keyed by ply index. */
  feedbackByPly: Record<number, AssistiveFeedback>
  /** Ply of the most recent player move — the one the live coach card shows. */
  lastPlayerPly: number | null
  setTurn: (turn: "player" | "engine" | "idle") => void
  setEngineThinking: (v: boolean) => void
  setPlyFeedback: (ply: number, feedback: AssistiveFeedback) => void
  setLastPlayerPly: (ply: number | null) => void
  clearFeedback: () => void
  reset: () => void
}

export const useAssistiveStore = create<AssistiveState>((set) => ({
  turn: "idle",
  engineThinking: false,
  feedbackByPly: {},
  lastPlayerPly: null,

  setTurn: (turn) => set({ turn }),
  setEngineThinking: (engineThinking) => set({ engineThinking }),

  setPlyFeedback: (ply, feedback) =>
    set((s) => ({ feedbackByPly: { ...s.feedbackByPly, [ply]: feedback } })),

  setLastPlayerPly: (lastPlayerPly) => set({ lastPlayerPly }),

  clearFeedback: () => set({ feedbackByPly: {}, lastPlayerPly: null }),

  reset: () =>
    set({ turn: "idle", engineThinking: false, feedbackByPly: {}, lastPlayerPly: null }),
}))
