import { create } from "zustand"
import { createSettingsStorage, type SettingsStorage } from "../lib/settingsStorage"
import { setSoundEnabled } from "../lib/sound"
import { applyTheme, type ThemeMode } from "../lib/theme"

export type Orientation = "white" | "black"
export type EnginePresetId = "eco" | "fast" | "balanced" | "deep" | "max"

export interface EngineConfig {
  preset: EnginePresetId
  threads: number
  hash: number
  multiPV: number
  depth: number
  scanDepth: number
}

export const ENGINE_PRESETS: Record<EnginePresetId, { label: string; threads: number; hash: number; multiPV: number; depth: number; scanDepth: number }> = {
  eco:       { label: "Eco",       threads: 1, hash: 16,  multiPV: 4, depth: 10, scanDepth: 8  },
  fast:      { label: "Fast",      threads: 1, hash: 32,  multiPV: 6, depth: 14, scanDepth: 12 },
  balanced:  { label: "Balanced",  threads: 2, hash: 64,  multiPV: 8, depth: 18, scanDepth: 14 },
  deep:      { label: "Deep",      threads: 4, hash: 128, multiPV: 8, depth: 24, scanDepth: 18 },
  max:       { label: "Max",       threads: 0, hash: 256, multiPV: 8, depth: 99, scanDepth: 24 },
}

export function resolveEngineConfig(preset: EnginePresetId): EngineConfig {
  const p = ENGINE_PRESETS[preset]
  const cores = (typeof navigator !== "undefined" ? navigator.hardwareConcurrency : undefined) ?? 4
  return {
    preset,
    threads: p.threads === 0 ? cores : p.threads,
    hash: p.hash,
    multiPV: p.multiPV,
    depth: p.depth,
    scanDepth: p.scanDepth,
  }
}

export interface AppConfig {
  orientation: Orientation
  playSpeed: number
}

interface ConfigState extends AppConfig {
  loaded: boolean
  lastSeenVersion: string
  openingAnalyzer: boolean
  sound: boolean
  theme: ThemeMode
  aiCommentary: boolean
  engineConfig: EngineConfig
  init: () => Promise<void>
  setOrientation: (orientation: Orientation) => void
  setPlaySpeed: (ms: number) => void
  setLastSeenVersion: (v: string) => void
  setOpeningAnalyzer: (on: boolean) => void
  setSound: (on: boolean) => void
  setTheme: (mode: ThemeMode) => void
  setAiCommentary: (on: boolean) => void
  setEnginePreset: (preset: EnginePresetId) => void
}

export const useConfigStore = create<ConfigState>((set) => {
  let storage: SettingsStorage | null = null

  async function ensureStorage() {
    if (!storage) {
      storage = await createSettingsStorage("settings.json")
    }
    return storage
  }

  return {
    orientation: "white",
    playSpeed: 500,
    loaded: false,
    lastSeenVersion: "",
    openingAnalyzer: true,
    sound: true,
    theme: "system",
    aiCommentary: false,
    engineConfig: resolveEngineConfig("balanced"),

    init: async () => {
      const st = await ensureStorage()
      const orientation = (await st.get<Orientation>("orientation")) ?? "white"
      const playSpeed = (await st.get<number>("playSpeed")) ?? 500
      const lastSeenVersion = (await st.get<string>("lastSeenVersion")) ?? ""
      const openingAnalyzer = (await st.get<boolean>("openingAnalyzer")) ?? true
      const sound = (await st.get<boolean>("sound")) ?? true
      const theme = (await st.get<ThemeMode>("theme")) ?? "system"
      const aiCommentary = (await st.get<boolean>("aiCommentary")) ?? false
      const enginePreset = (await st.get<EnginePresetId>("enginePreset")) ?? "balanced"
      const engineConfig = resolveEngineConfig(enginePreset)
      setSoundEnabled(sound)
      applyTheme(theme)
      set({ orientation, playSpeed, lastSeenVersion, openingAnalyzer, sound, theme, aiCommentary, engineConfig, loaded: true })
    },

    setOrientation: async (orientation) => {
      set({ orientation })
      const st = await ensureStorage()
      await st.set("orientation", orientation)
    },

    setPlaySpeed: async (playSpeed) => {
      set({ playSpeed })
      const st = await ensureStorage()
      await st.set("playSpeed", playSpeed)
    },

    setLastSeenVersion: async (lastSeenVersion) => {
      set({ lastSeenVersion })
      const st = await ensureStorage()
      await st.set("lastSeenVersion", lastSeenVersion)
    },

    setOpeningAnalyzer: async (openingAnalyzer) => {
      set({ openingAnalyzer })
      const st = await ensureStorage()
      await st.set("openingAnalyzer", openingAnalyzer)
    },

    setSound: async (sound) => {
      setSoundEnabled(sound)
      set({ sound })
      const st = await ensureStorage()
      await st.set("sound", sound)
    },

    setTheme: async (theme) => {
      applyTheme(theme)
      set({ theme })
      const st = await ensureStorage()
      await st.set("theme", theme)
    },

    setAiCommentary: async (aiCommentary) => {
      set({ aiCommentary })
      const st = await ensureStorage()
      await st.set("aiCommentary", aiCommentary)
    },

    setEnginePreset: async (preset) => {
      const engineConfig = resolveEngineConfig(preset)
      set({ engineConfig })
      const st = await ensureStorage()
      await st.set("enginePreset", preset)
    },
  }
})
