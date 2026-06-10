import { create } from "zustand"

export type SaveStatus = "idle" | "saving" | "saved"

interface SaveState {
  status: SaveStatus
  lastSavedAt: number | null
  setStatus: (status: SaveStatus) => void
  markSaving: () => void
  markSaved: () => void
  markIdle: () => void
}

export const useSaveStore = create<SaveState>((set) => ({
  status: "idle",
  lastSavedAt: null,

  setStatus: (status) => set({ status }),
  markSaving: () => set({ status: "saving" }),
  markSaved: () => set({ status: "saved", lastSavedAt: Date.now() }),
  markIdle: () => set({ status: "idle" }),
}))
