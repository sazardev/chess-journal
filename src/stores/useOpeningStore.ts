import { create } from "zustand"
import type { OpeningInfo } from "../lib/openings"

interface OpeningState {
  current: OpeningInfo | null
  setCurrent: (info: OpeningInfo | null) => void
}

export const useOpeningStore = create<OpeningState>((set) => ({
  current: null,
  setCurrent: (current) => set({ current }),
}))
