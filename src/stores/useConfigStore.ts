import { create } from "zustand"
import { load } from "@tauri-apps/plugin-store"

export type Orientation = "white" | "black"

export interface AppConfig {
  orientation: Orientation
  playSpeed: number
}

interface ConfigState extends AppConfig {
  loaded: boolean
  lastSeenVersion: string
  init: () => Promise<void>
  setOrientation: (orientation: Orientation) => void
  setPlaySpeed: (ms: number) => void
  setLastSeenVersion: (v: string) => void
}

export const useConfigStore = create<ConfigState>((set) => {
  let store: Awaited<ReturnType<typeof load>> | null = null

  async function ensureStore() {
    if (!store) {
      store = await load("settings.json")
    }
    return store
  }

  return {
    orientation: "white",
    playSpeed: 500,
    loaded: false,
    lastSeenVersion: "",

    init: async () => {
      const st = await ensureStore()
      const orientation = (await st.get<Orientation>("orientation")) ?? "white"
      const playSpeed = (await st.get<number>("playSpeed")) ?? 500
      const lastSeenVersion = (await st.get<string>("lastSeenVersion")) ?? ""
      set({ orientation, playSpeed, lastSeenVersion, loaded: true })
    },

    setOrientation: async (orientation) => {
      set({ orientation })
      const st = await ensureStore()
      await st.set("orientation", orientation)
    },

    setPlaySpeed: async (playSpeed) => {
      set({ playSpeed })
      const st = await ensureStore()
      await st.set("playSpeed", playSpeed)
    },

    setLastSeenVersion: async (lastSeenVersion) => {
      set({ lastSeenVersion })
      const st = await ensureStore()
      await st.set("lastSeenVersion", lastSeenVersion)
    },
  }
})
