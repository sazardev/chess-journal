import { create } from "zustand"
import type { SaveData } from "../types/save"
import { usePersistenceStore } from "./usePersistenceStore"

export interface LibraryEntry {
  id: string
  data: SaveData
  savedAt: string
}

function uid(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7)
}

interface LibraryState {
  entries: LibraryEntry[]
  addEntry: (data: SaveData, id?: string) => Promise<string>
  removeEntry: (id: string) => Promise<void>
  loadFromStorage: () => Promise<void>
}

async function persist(entries: LibraryEntry[]) {
  await usePersistenceStore.getState().writeLibrary(entries)
}

export const useLibraryStore = create<LibraryState>((set, get) => ({
  entries: [],

  addEntry: async (data, existingId?) => {
    const { entries } = get()
    const id = existingId ?? uid()
    const entry: LibraryEntry = {
      id,
      data: {
        ...data,
        meta: { ...data.meta, updatedAt: new Date().toISOString() },
      },
      savedAt: new Date().toISOString(),
    }

    const idx = entries.findIndex((e) => e.id === id)
    const next = idx >= 0
      ? entries.map((e, i) => (i === idx ? entry : e))
      : [entry, ...entries]

    const trimmed = next.slice(0, 50)
    set({ entries: trimmed })
    await persist(trimmed)
    return id
  },

  removeEntry: async (id) => {
    const next = get().entries.filter((e) => e.id !== id)
    set({ entries: next })
    await persist(next)
  },

  loadFromStorage: async () => {
    const store = usePersistenceStore.getState()
    if (!store.ready) return
    const entries = await store.readLibrary()
    set({ entries })
  },
}))
