import { create } from "zustand"
import type { SaveData } from "../types/save"
import type { PuzzleProgress } from "./usePuzzleProgressStore"

const AUTOSAVE = "autosave.json"
const LIBRARY = "library.json"
const PUZZLE_PROGRESS = "puzzle-progress.json"

interface PersistenceState {
  ready: boolean
  dataDir: string
  autosaveLoaded: boolean
  init: () => Promise<void>
  writeAutosave: (data: SaveData) => Promise<void>
  readAutosave: () => Promise<SaveData | null>
  clearAutosave: () => Promise<void>
  writeLibrary: (entries: { id: string; data: SaveData; savedAt: string }[]) => Promise<void>
  readLibrary: () => Promise<{ id: string; data: SaveData; savedAt: string }[]>
  writePuzzleProgress: (progress: PuzzleProgress) => Promise<void>
  readPuzzleProgress: () => Promise<PuzzleProgress>
  clearAll: () => Promise<void>
}

async function resolveDataDir(): Promise<string> {
  try {
    const { appDataDir } = await import("@tauri-apps/api/path")
    const base = await appDataDir()
    return `${base}data`
  } catch {
    return "__local__"
  }
}

async function tauriAvailable(): Promise<boolean> {
  try {
    await import("@tauri-apps/api/path")
    await import("@tauri-apps/plugin-fs")
    return true
  } catch {
    return false
  }
}

function localGet<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(`chess-journal-${key}`)
    return raw ? (JSON.parse(raw) as T) : fallback
  } catch {
    return fallback
  }
}

function localSet(key: string, value: unknown) {
  try {
    localStorage.setItem(`chess-journal-${key}`, JSON.stringify(value))
  } catch { /* ignore */ }
}

function migrateLocalStorage() {
  const OLD = "chess-mini-"
  const NEW = "chess-journal-"
  if (localStorage.getItem("chess-journal-migrated")) return
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i)
      if (key?.startsWith(OLD)) {
        const newKey = key.replace(OLD, NEW)
        if (!localStorage.getItem(newKey)) {
          const value = localStorage.getItem(key)
          if (value) localStorage.setItem(newKey, value)
        }
      }
    }
    localStorage.setItem("chess-journal-migrated", "1")
  } catch { /* ignore */ }
}

async function migrateTauriDataDir() {
  try {
    const { appDataDir, dirname, join } = await import("@tauri-apps/api/path")
    const { exists, readTextFile, writeTextFile } = await import("@tauri-apps/plugin-fs")

    const newBase = await appDataDir()
    const oldBase = await join(await dirname(newBase), "com.chess-mini.app")
    const oldDataDir = await join(oldBase, "data")

    if (!(await exists(oldDataDir))) return

    const files = [AUTOSAVE, LIBRARY, PUZZLE_PROGRESS]
    for (const file of files) {
      const oldPath = await join(oldDataDir, file)
      const newPath = await join(newBase, "data", file)

      if ((await exists(oldPath)) && !(await exists(newPath))) {
        try {
          const content = await readTextFile(oldPath)
          await writeTextFile(newPath, content)
        } catch { /* skip individual file failures */ }
      }
    }
  } catch { /* ignore — best effort */ }
}

export const usePersistenceStore = create<PersistenceState>((set, get) => ({
  ready: false,
  dataDir: "",
  autosaveLoaded: false,

  init: async () => {
    migrateLocalStorage()

    const dir = await resolveDataDir()
    const tauri = await tauriAvailable()

    if (tauri && dir !== "__local__") {
      await migrateTauriDataDir()
      try {
        const { exists, mkdir } = await import("@tauri-apps/plugin-fs")
        const dirExists = await exists(dir)
        if (!dirExists) {
          await mkdir(dir, { recursive: true })
        }
      } catch {
        set({ ready: true, dataDir: "__local__", autosaveLoaded: false })
        return
      }
    }

    set({ ready: true, dataDir: dir })
  },

  writeAutosave: async (data) => {
    const { dataDir } = get()
    const json = JSON.stringify(data)

    if (dataDir !== "__local__") {
      try {
        const { writeTextFile } = await import("@tauri-apps/plugin-fs")
        await writeTextFile(`${dataDir}/${AUTOSAVE}`, json)
        return
      } catch { /* ignore */ }
    }

    localSet("autosave", data)
  },

  readAutosave: async () => {
    const { dataDir } = get()

    if (dataDir !== "__local__") {
      try {
        const { exists, readTextFile } = await import("@tauri-apps/plugin-fs")
        const path = `${dataDir}/${AUTOSAVE}`
        const fileExists = await exists(path)
        if (fileExists) {
          const raw = await readTextFile(path)
          return JSON.parse(raw) as SaveData | null
        }
      } catch { /* ignore */ }
    }

    return localGet<SaveData | null>("autosave", null)
  },

  clearAutosave: async () => {
    const { dataDir } = get()

    if (dataDir !== "__local__") {
      try {
        const { writeTextFile } = await import("@tauri-apps/plugin-fs")
        await writeTextFile(`${dataDir}/${AUTOSAVE}`, "null")
        return
      } catch { /* ignore */ }
    }

    try {
      localStorage.removeItem("chess-journal-autosave")
    } catch { /* ignore */ }
  },

  writeLibrary: async (entries) => {
    const { dataDir } = get()
    const json = JSON.stringify(entries)

    if (dataDir !== "__local__") {
      try {
        const { writeTextFile } = await import("@tauri-apps/plugin-fs")
        await writeTextFile(`${dataDir}/${LIBRARY}`, json)
        return
      } catch { /* ignore */ }
    }

    localSet("library", entries)
  },

  readLibrary: async () => {
    const { dataDir } = get()

    if (dataDir !== "__local__") {
      try {
        const { exists, readTextFile } = await import("@tauri-apps/plugin-fs")
        const path = `${dataDir}/${LIBRARY}`
        const fileExists = await exists(path)
        if (fileExists) {
          const raw = await readTextFile(path)
          const data = JSON.parse(raw)
          if (Array.isArray(data)) return data
        }
      } catch { /* ignore */ }
    }

    return localGet<{ id: string; data: SaveData; savedAt: string }[]>("library", [])
  },

  writePuzzleProgress: async (progress) => {
    const { dataDir } = get()
    const json = JSON.stringify(progress)

    if (dataDir !== "__local__") {
      try {
        const { writeTextFile } = await import("@tauri-apps/plugin-fs")
        await writeTextFile(`${dataDir}/${PUZZLE_PROGRESS}`, json)
        return
      } catch { /* ignore */ }
    }

    localSet("puzzle-progress", progress)
  },

  readPuzzleProgress: async () => {
    const { dataDir } = get()

    if (dataDir !== "__local__") {
      try {
        const { exists, readTextFile } = await import("@tauri-apps/plugin-fs")
        const path = `${dataDir}/${PUZZLE_PROGRESS}`
        const fileExists = await exists(path)
        if (fileExists) {
          const raw = await readTextFile(path)
          const data = JSON.parse(raw)
          if (data && typeof data === "object") return data as PuzzleProgress
        }
      } catch { /* ignore */ }
    }

    return localGet<PuzzleProgress>("puzzle-progress", {})
  },

  clearAll: async () => {
    const { dataDir } = get()

    if (dataDir !== "__local__") {
      try {
        const { writeTextFile } = await import("@tauri-apps/plugin-fs")
        await writeTextFile(`${dataDir}/${AUTOSAVE}`, "null")
        await writeTextFile(`${dataDir}/${LIBRARY}`, "[]")
        await writeTextFile(`${dataDir}/${PUZZLE_PROGRESS}`, "{}")
        return
      } catch { /* ignore */ }
    }

    try {
      localStorage.removeItem("chess-journal-autosave")
      localStorage.removeItem("chess-journal-library")
      localStorage.removeItem("chess-journal-puzzle-progress")
    } catch { /* ignore */ }
  },
}))
