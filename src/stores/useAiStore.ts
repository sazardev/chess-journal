/**
 * Drives on-device AI commentary behind a single switch. `enable()` orchestrates
 * the whole thing — download assets if missing, then start the engine — and
 * `disable()` stops it. The UI only sees a `phase` + a friendly step label +
 * progress; model/engine specifics are intentionally hidden from the user.
 */

import { create } from "zustand"
import { invoke } from "@tauri-apps/api/core"
import { listen } from "@tauri-apps/api/event"
import { detectCapability, type Capability } from "../lib/ai/capability"
import { findModel, DEFAULT_MODEL_ID, setRuntime, unavailableRuntime } from "../lib/ai/runtime"
import { tauriRuntime } from "../lib/ai/tauriRuntime"
import { useConfigStore } from "./useConfigStore"
import { useAiCacheStore } from "./useAiCacheStore"

export type AiPhase = "unsupported" | "idle" | "preparing" | "ready" | "error"

interface AiState {
  capability: Capability
  modelId: string
  phase: AiPhase
  /** User-facing step label while preparing (no technical names). */
  step: string
  /** Progress 0..1 for a download step (0 for indeterminate steps like starting). */
  progress: number
  error: string | null
  /** Whether any AI assets are on disk (model and/or engine). */
  assetsPresent: boolean
  init: () => Promise<void>
  enable: () => Promise<void>
  disable: () => Promise<void>
  /** Stop the engine and delete all downloaded AI assets; turns AI off. */
  removeAssets: () => Promise<void>
}

const DOWNLOAD_STEP = "Downloading AI assets…"

export const useAiStore = create<AiState>((set, get) => ({
  capability: { deviceMemoryGb: null, cores: 4, tier: "unknown", reason: "" },
  modelId: DEFAULT_MODEL_ID,
  phase: "idle",
  step: "",
  progress: 0,
  error: null,
  assetsPresent: false,

  init: async () => {
    const capability = detectCapability()
    let assetsPresent = false
    try {
      const model = findModel(get().modelId)
      const hasModel = model
        ? await invoke<boolean>("ai_model_exists", { fileName: model.fileName })
        : false
      const hasEngine = await invoke<boolean>("ai_server_installed")
      assetsPresent = hasModel || hasEngine
    } catch {
      /* not under Tauri (dev/test) */
    }
    set({ capability, phase: capability.tier === "unsupported" ? "unsupported" : "idle", assetsPresent })
  },

  enable: async () => {
    const { phase, capability } = get()
    if (phase === "preparing" || phase === "ready") return // already on / in progress
    if (capability.tier === "unsupported") {
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
      const hasModel = await invoke<boolean>("ai_model_exists", { fileName: model.fileName }).catch(
        () => false,
      )
      if (!hasModel) {
        set({ step: DOWNLOAD_STEP, progress: 0 })
        const un = await listen<{ downloaded: number; total: number }>(
          "ai-download-progress",
          (e) => {
            const { downloaded, total } = e.payload
            set({ progress: total > 0 ? Math.min(1, downloaded / total) : 0 })
          },
        )
        try {
          await invoke("ai_download", { url: model.url, fileName: model.fileName })
        } finally {
          un()
        }
      }

      // 2) AI assets: the engine.
      const hasEngine = await invoke<boolean>("ai_server_installed").catch(() => false)
      if (!hasEngine) {
        set({ step: DOWNLOAD_STEP, progress: 0 })
        const un = await listen<{ downloaded: number; total: number }>(
          "ai-engine-progress",
          (e) => {
            const { downloaded, total } = e.payload
            set({ progress: total > 0 ? Math.min(1, downloaded / total) : 0 })
          },
        )
        try {
          await invoke("ai_server_install")
        } finally {
          un()
        }
      }

      // The user may have toggled AI off while assets were downloading.
      if (!useConfigStore.getState().aiCommentary) {
        set({ phase: "idle", step: "", progress: 0 })
        return
      }

      // Both assets are on disk now.
      set({ assetsPresent: true })

      // 3) Start (loads the model into memory).
      set({ step: "Starting AI…", progress: 0 })
      await invoke("ai_start", { modelFile: model.fileName })
      if (!useConfigStore.getState().aiCommentary) {
        try {
          await invoke("ai_stop")
        } catch {
          /* ignore */
        }
        setRuntime(unavailableRuntime)
        set({ phase: "idle", step: "", progress: 0 })
        return
      }
      setRuntime(tauriRuntime)
      set({ phase: "ready", step: "", progress: 1, error: null })
    } catch (e) {
      setRuntime(unavailableRuntime)
      console.error("AI setup failed:", e)
      set({ phase: "error", step: "", error: "Couldn't set up AI. Toggle it off and on to retry." })
    }
  },

  disable: async () => {
    try {
      await invoke("ai_stop")
    } catch {
      /* ignore — best effort */
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
    // Turn AI off first so the App effect doesn't re-download, then stop + delete.
    useConfigStore.getState().setAiCommentary(false)
    await get().disable()
    try {
      await invoke("ai_remove_all")
    } catch {
      /* ignore — best effort */
    }
    useAiCacheStore.getState().clear() // comments were tied to the removed model
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
