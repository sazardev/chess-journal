import { create } from "zustand"
import type { SaveData } from "../types/save"

export interface LibraryEntry {
  id: string
  data: SaveData
  savedAt: string
}

function uid(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7)
}

function loadFromStorage(): LibraryEntry[] {
  try {
    const raw = localStorage.getItem("chess-mini-library")
    if (!raw) return []
    const parsed: LibraryEntry[] = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed
  } catch {
    return []
  }
}

function saveToStorage(entries: LibraryEntry[]) {
  try {
    localStorage.setItem("chess-mini-library", JSON.stringify(entries))
  } catch {}
}

interface LibraryState {
  entries: LibraryEntry[]
  addEntry: (data: SaveData, id?: string) => string
  removeEntry: (id: string) => void
  loadFromStorage: () => void
}

export const useLibraryStore = create<LibraryState>((set, get) => ({
  entries: [],

  addEntry: (data, existingId) => {
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
    saveToStorage(trimmed)
    return id
  },

  removeEntry: (id) => {
    const next = get().entries.filter((e) => e.id !== id)
    set({ entries: next })
    saveToStorage(next)
  },

  loadFromStorage: () => {
    const entries = loadFromStorage()
    set({ entries })
  },
}))
