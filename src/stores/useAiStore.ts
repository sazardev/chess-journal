/**
 * Drives on-device AI commentary behind a single switch. `enable()` orchestrates
 * the whole thing — download assets if missing, then start the engine — and
 * `disable()` stops it. The UI only sees a `phase` + a friendly step label +
 * progress; model/engine specifics are intentionally hidden from the user.
 */

import { create } from "zustand"
import { isTauri } from "../lib/tauriGate"
import { detectCapability, type Capability } from "../lib/ai/capability"
import { findModel, DEFAULT_MODEL_ID, setRuntime, unavailableRuntime } from "../lib/ai/runtime"
import { useConfigStore } from "./useConfigStore"
import { useAiCacheStore } from "./useAiCacheStore"

export type AiPhase = "unsupported" | "idle" | "preparing" | "ready" | "error"

interface AiState {
  capability: Capability
  modelId: string
  phase: AiPhase
  step: string
  progress: number
  error: string | null
  assetsPresent: boolean
  init: () => Promise<void>
  enable: () => Promise<void>
  disable: () => Promise<void>
  removeAssets: () => Promise<void>
}

const DOWNLOAD_STEP = "Downloading AI assets…"

async function invokeTauri<T>(cmd: string, args?: Record<string, unknown>): Promise<T> {
  const { invoke } = await import("@tauri-apps/api/core")
  return invoke<T>(cmd, args)
}

async function listenTauri<T>(event: string, handler: (payload: T) => void) {
  const { listen } = await import("@tauri-apps/api/event")
  return listen<T>(event, (e) => handler(e.payload))
}

export const useAiStore = create<AiState>((set, get) => ({
  capability: { deviceMemoryGb: null, cores: 4, tier: "unknown", reason: "" },
  modelId: DEFAULT_MODEL_ID,
  phase: "idle",
  step: "",
  progress: 0,
  error: null,
  assetsPresent: false,

  init: async () => {
    if (!(await isTauri())) {
      set({ phase: "unsupported" })
      return
    }
    const capability = detectCapability()
    let assetsPresent = false
    try {
      const model = findModel(get().modelId)
      const hasModel = model
        ? await invokeTauri<boolean>("ai_model_exists", { fileName: model.fileName })
        : false
      const hasEngine = await invokeTauri<boolean>("ai_server_installed")
      assetsPresent = hasModel || hasEngine
    } catch {
      /* not under Tauri (web) */
    }
    set({ capability, phase: capability.tier === "unsupported" ? "unsupported" : "idle", assetsPresent })
  },

  enable: async () => {
    const { phase, capability } = get()
    if (phase === "preparing" || phase === "ready") return
    if (capability.tier === "unsupported") {
      set({ phase: "unsupported" })
      return
    }
    if (!(await isTauri())) {
      set({ phase: "unsupported" })
      return
    }
    const model = findModel(get().modelId)
    if (!model) {
      set({ phase: "error", error: "On-device AI is unavailable." })
      return
    }

    set({ phase: "preparing", step: "Preparing AI…", progress: 0, error: null })
    try {
      // 1) AI assets: the model.
      const hasModel = await invokeTauri<boolean>("ai_model_exists", { fileName: model.fileName }).catch(
        () => false,
      )
      if (!hasModel) {
        set({ step: DOWNLOAD_STEP, progress: 0 })
        const un = await listenTauri<{ downloaded: number; total: number }>(
          "ai-download-progress",
          (e) => {
            const { downloaded, total } = e
            set({ progress: total > 0 ? Math.min(1, downloaded / total) : 0 })
          },
        )
        try {
          await invokeTauri("ai_download", { url: model.url, fileName: model.fileName })
        } finally {
          un()
        }
      }

      // 2) AI assets: the engine.
      const hasEngine = await invokeTauri<boolean>("ai_server_installed").catch(() => false)
      if (!hasEngine) {
        set({ step: DOWNLOAD_STEP, progress: 0 })
        const un = await listenTauri<{ downloaded: number; total: number }>(
          "ai-engine-progress",
          (e) => {
            const { downloaded, total } = e
            set({ progress: total > 0 ? Math.min(1, downloaded / total) : 0 })
          },
        )
        try {
          await invokeTauri("ai_server_install")
        } finally {
          un()
        }
      }

      if (!useConfigStore.getState().aiCommentary) {
        set({ phase: "idle", step: "", progress: 0 })
        return
      }

      set({ assetsPresent: true })

      // 3) Start (loads the model into memory).
      set({ step: "Starting AI…", progress: 0 })
      await invokeTauri("ai_start", { modelFile: model.fileName })
      if (!useConfigStore.getState().aiCommentary) {
        try {
          await invokeTauri("ai_stop")
        } catch {
          /* ignore */
        }
        setRuntime(unavailableRuntime)
        set({ phase: "idle", step: "", progress: 0 })
        return
      }
      // Lazy-import the Tauri runtime only when AI is confirmed on.
      const { tauriRuntime } = await import("../lib/ai/tauriRuntime")
      setRuntime(tauriRuntime)
      set({ phase: "ready", step: "", progress: 1, error: null })
    } catch (e) {
      setRuntime(unavailableRuntime)
      console.error("AI setup failed:", e)
      set({ phase: "error", step: "", error: "Couldn't set up AI. Toggle it off and on to retry." })
    }
  },

  disable: async () => {
    if (await isTauri()) {
      try {
        await invokeTauri("ai_stop")
      } catch {
        /* ignore — best effort */
      }
    }
    setRuntime(unavailableRuntime)
    set({
      phase: get().capability.tier === "unsupported" ? "unsupported" : "idle",
      step: "",
      progress: 0,
      error: null,
    })
  },

  removeAssets: async () => {
    useConfigStore.getState().setAiCommentary(false)
    await get().disable()
    if (await isTauri()) {
      try {
        await invokeTauri("ai_remove_all")
      } catch {
        /* ignore — best effort */
      }
    }
    useAiCacheStore.getState().clear()
    set({
      assetsPresent: false,
      phase: get().capability.tier === "unsupported" ? "unsupported" : "idle",
      step: "",
      progress: 0,
      error: null,
    })
  },
}))

export { DOWNLOAD_STEP }
