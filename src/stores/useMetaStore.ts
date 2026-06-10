import { create } from "zustand"
import type { SaveData } from "../types/save"

interface MetaState {
  name: string
  rating: number
  tags: string[]
  notes: string
  createdAt: string
  updatedAt: string
  setName: (n: string) => void
  setRating: (r: number) => void
  setTags: (t: string[]) => void
  setNotes: (n: string) => void
  reset: () => void
  load: (meta: SaveData["meta"]) => void
  snapshot: () => SaveData["meta"]
}

const defaults = (): SaveData["meta"] => ({
  name: "Untitled",
  rating: 0,
  tags: [],
  notes: "",
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
})

export const useMetaStore = create<MetaState>((set, get) => ({
  ...defaults(),

  setName: (name) => set({ name, updatedAt: new Date().toISOString() }),
  setRating: (rating) => set({ rating, updatedAt: new Date().toISOString() }),
  setTags: (tags) => set({ tags, updatedAt: new Date().toISOString() }),
  setNotes: (notes) => set({ notes, updatedAt: new Date().toISOString() }),

  reset: () => set(defaults()),

  load: (meta) =>
    set({
      name: meta.name || "Untitled",
      rating: meta.rating ?? 0,
      tags: meta.tags ?? [],
      notes: meta.notes ?? "",
      createdAt: meta.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }),

  snapshot: () => {
    const s = get()
    return {
      name: s.name,
      rating: s.rating,
      tags: s.tags,
      notes: s.notes,
      createdAt: s.createdAt,
      updatedAt: s.updatedAt,
    }
  },
}))
