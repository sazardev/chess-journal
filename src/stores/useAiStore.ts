/**
 * Manages local AI commentary (Tier 1): device capability, the model file
 * (download / remove), and the llama-server engine (install / start / stop). All
 * heavy lifting is in Rust commands; this store tracks state and, once the engine
 * is running, registers the `tauriRuntime` so `useExplainer` switches to the LLM.
 */

import { create } from "zustand"
import { invoke } from "@tauri-apps/api/core"
import { listen } from "@tauri-apps/api/event"
import { detectCapability, type Capability } from "../lib/ai/capability"
import { findModel, DEFAULT_MODEL_ID, setRuntime, unavailableRuntime } from "../lib/ai/runtime"
import { tauriRuntime } from "../lib/ai/tauriRuntime"
import { useAiCacheStore } from "./useAiCacheStore"

export type ModelState = "unsupported" | "absent" | "downloading" | "downloaded" | "error"
export type EngineState = "absent" | "installing" | "stopped" | "starting" | "ready" | "error"

interface AiState {
  capability: Capability
  modelId: string
  modelState: ModelState
  /** Model download progress 0..1. */
  progress: number
  error: string | null

  engineState: EngineState
  /** Engine install (download) progress 0..1. */
  engineProgress: number
  engineError: string | null

  init: () => Promise<void>
  download: () => Promise<void>
  remove: () => Promise<void>
  installEngine: () => Promise<void>
  startEngine: () => Promise<void>
  stopEngine: () => Promise<void>
}

export const useAiStore = create<AiState>((set, get) => ({
  capability: { deviceMemoryGb: null, cores: 4, tier: "unknown", reason: "" },
  modelId: DEFAULT_MODEL_ID,
  modelState: "absent",
  progress: 0,
  error: null,

  engineState: "absent",
  engineProgress: 0,
  engineError: null,

  init: async () => {
    const capability = detectCapability()
    if (capability.tier === "unsupported") {
      set({ capability, modelState: "unsupported", engineState: "absent" })
      return
    }
    const model = findModel(get().modelId)
    let downloaded = false
    let engineInstalled = false
    try {
      if (model) downloaded = await invoke<boolean>("ai_model_exists", { fileName: model.fileName })
      engineInstalled = await invoke<boolean>("ai_server_installed")
    } catch {
      // not running under Tauri (dev/test) — treat as not installed
    }
    set({
      capability,
      modelState: downloaded ? "downloaded" : "absent",
      engineState: engineInstalled ? "stopped" : "absent",
      error: null,
      engineError: null,
    })
  },

  download: async () => {
    const model = findModel(get().modelId)
    if (!model) {
      set({ error: "Unknown model." })
      return
    }
    set({ modelState: "downloading", progress: 0, error: null })
    try {
      const unlisten = await listen<{ downloaded: number; total: number }>(
        "ai-download-progress",
        (e) => {
          const { downloaded, total } = e.payload
          set({ progress: total > 0 ? Math.min(1, downloaded / total) : 0 })
        },
      )
      try {
        await invoke("ai_download", { url: model.url, fileName: model.fileName })
        set({ modelState: "downloaded", progress: 1 })
      } finally {
        unlisten()
      }
    } catch (e) {
      set({ modelState: "error", error: e instanceof Error ? e.message : String(e) })
    }
  },

  remove: async () => {
    // Stop the engine first — it holds the model file open.
    if (get().engineState === "ready") await get().stopEngine()
    const model = findModel(get().modelId)
    if (model) {
      try {
        await invoke("ai_remove", { fileName: model.fileName })
      } catch {
        /* ignore — best effort */
      }
    }
    useAiCacheStore.getState().clear()
    set({ modelState: "absent", progress: 0, error: null })
  },

  installEngine: async () => {
    set({ engineState: "installing", engineProgress: 0, engineError: null })
    try {
      const unlisten = await listen<{ downloaded: number; total: number }>(
        "ai-engine-progress",
        (e) => {
          const { downloaded, total } = e.payload
          set({ engineProgress: total > 0 ? Math.min(1, downloaded / total) : 0 })
        },
      )
      try {
        await invoke("ai_server_install")
        set({ engineState: "stopped", engineProgress: 1 })
      } finally {
        unlisten()
      }
    } catch (e) {
      set({ engineState: "error", engineError: e instanceof Error ? e.message : String(e) })
    }
  },

  startEngine: async () => {
    const model = findModel(get().modelId)
    if (!model || get().modelState !== "downloaded") {
      set({ engineError: "Download the model first." })
      return
    }
    set({ engineState: "starting", engineError: null })
    try {
      await invoke("ai_start", { modelFile: model.fileName })
      setRuntime(tauriRuntime)
      set({ engineState: "ready" })
    } catch (e) {
      setRuntime(unavailableRuntime)
      set({ engineState: "error", engineError: e instanceof Error ? e.message : String(e) })
    }
  },

  stopEngine: async () => {
    try {
      await invoke("ai_stop")
    } catch {
      /* ignore — best effort */
    }
    setRuntime(unavailableRuntime)
    set({ engineState: "stopped" })
  },
}))
