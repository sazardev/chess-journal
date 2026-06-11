import { isTauri } from "./tauriGate"

export interface SettingsStorage {
  get<T>(key: string): Promise<T | null>
  set(key: string, value: unknown): Promise<void>
  save(): Promise<void>
}

function localKey(fileName: string, key: string): string {
  return `chess-mini-${fileName}-${key}`
}

function localStorageAdapter(fileName: string): SettingsStorage {
  return {
    async get<T>(key: string): Promise<T | null> {
      try {
        const raw = localStorage.getItem(localKey(fileName, key))
        return raw ? (JSON.parse(raw) as T) : null
      } catch {
        return null
      }
    },
    async set(key: string, value: unknown): Promise<void> {
      try {
        localStorage.setItem(localKey(fileName, key), JSON.stringify(value))
      } catch { /* ignore */ }
    },
    async save(): Promise<void> {
      // localStorage is sync, no explicit save needed
    },
  }
}

export async function createSettingsStorage(fileName: string): Promise<SettingsStorage> {
  if (await isTauri()) {
    try {
      const { load } = await import("@tauri-apps/plugin-store")
      const store = await load(fileName)
      return {
        async get<T>(key: string): Promise<T | null> {
          return (await store.get<T>(key)) ?? null
        },
        async set(key: string, value: unknown): Promise<void> {
          await store.set(key, value)
        },
        async save(): Promise<void> {
          await store.save()
        },
      }
    } catch {
      // Tauri detected but plugin-store unavailable — fall through
    }
  }
  return localStorageAdapter(fileName)
}
