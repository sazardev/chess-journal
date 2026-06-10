import { create } from "zustand"
import type { SaveData } from "../types/save"

const AUTOSAVE = "autosave.json"
const LIBRARY = "library.json"

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
    const raw = localStorage.getItem(`chess-mini-${key}`)
    return raw ? (JSON.parse(raw) as T) : fallback
  } catch {
    return fallback
  }
}

function localSet(key: string, value: unknown) {
  try {
    localStorage.setItem(`chess-mini-${key}`, JSON.stringify(value))
  } catch { /* ignore */ }
}

export const usePersistenceStore = create<PersistenceState>((set, get) => ({
  ready: false,
  dataDir: "",
  autosaveLoaded: false,

  init: async () => {
    const dir = await resolveDataDir()
    const tauri = await tauriAvailable()

    if (tauri && dir !== "__local__") {
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
      localStorage.removeItem("chess-mini-autosave")
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

  clearAll: async () => {
    const { dataDir } = get()

    if (dataDir !== "__local__") {
      try {
        const { writeTextFile } = await import("@tauri-apps/plugin-fs")
        await writeTextFile(`${dataDir}/${AUTOSAVE}`, "null")
        await writeTextFile(`${dataDir}/${LIBRARY}`, "[]")
        return
      } catch { /* ignore */ }
    }

    try {
      localStorage.removeItem("chess-mini-autosave")
      localStorage.removeItem("chess-mini-library")
    } catch { /* ignore */ }
  },
}))
