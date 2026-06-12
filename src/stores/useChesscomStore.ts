import { create } from "zustand"
import { createSettingsStorage, type SettingsStorage } from "../lib/settingsStorage"

export interface SavedUser {
  username: string
  lastImportedAt: string
  autoFetch: boolean
}

interface ChesscomState {
  savedUsers: SavedUser[]
  loaded: boolean
  init: () => Promise<void>
  addUser: (username: string) => Promise<void>
  removeUser: (username: string) => Promise<void>
  toggleAutoFetch: (username: string) => Promise<void>
  updateLastImported: (username: string) => Promise<void>
}

export const useChesscomStore = create<ChesscomState>((set, get) => {
  let storage: SettingsStorage | null = null

  async function ensureStorage() {
    if (!storage) storage = await createSettingsStorage("chesscom.json")
    return storage
  }

  async function persist() {
    const st = await ensureStorage()
    await st.set("users", get().savedUsers)
    await st.save()
  }

  return {
    savedUsers: [],
    loaded: false,

    init: async () => {
      const st = await ensureStorage()
      const users = (await st.get<SavedUser[]>("users")) ?? []
      set({ savedUsers: users, loaded: true })
    },

    addUser: async (username) => {
      const { savedUsers } = get()
      const lower = username.trim().toLowerCase()
      const existing = savedUsers.find((u) => u.username.toLowerCase() === lower)
      if (existing) {
        const next = savedUsers.map((u) =>
          u.username.toLowerCase() === lower
            ? { ...u, lastImportedAt: new Date().toISOString() }
            : u,
        )
        set({ savedUsers: next })
      } else {
        set({
          savedUsers: [
            {
              username: username.trim(),
              lastImportedAt: new Date().toISOString(),
              autoFetch: false,
            },
            ...savedUsers,
          ],
        })
      }
      await persist()
    },

    removeUser: async (username) => {
      const next = get().savedUsers.filter(
        (u) => u.username.toLowerCase() !== username.toLowerCase(),
      )
      set({ savedUsers: next })
      await persist()
    },

    toggleAutoFetch: async (username) => {
      const next = get().savedUsers.map((u) =>
        u.username.toLowerCase() === username.toLowerCase()
          ? { ...u, autoFetch: !u.autoFetch }
          : u,
      )
      set({ savedUsers: next })
      await persist()
    },

    updateLastImported: async (username) => {
      const next = get().savedUsers.map((u) =>
        u.username.toLowerCase() === username.toLowerCase()
          ? { ...u, lastImportedAt: new Date().toISOString() }
          : u,
      )
      set({ savedUsers: next })
      await persist()
    },
  }
})
