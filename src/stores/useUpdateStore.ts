import { create } from "zustand"
import type { Update } from "@tauri-apps/plugin-updater"
import { checkForUpdate, installAndRelaunch } from "../lib/updater"

export type UpdateStatus =
  | "idle"
  | "checking"
  | "available"
  | "uptodate"
  | "downloading"
  | "error"

interface UpdateState {
  status: UpdateStatus
  version: string | null
  notes: string | null
  progress: number // 0..1
  error: string | null
  update: Update | null
  check: (silent?: boolean) => Promise<void>
  install: () => Promise<void>
}

export const useUpdateStore = create<UpdateState>((set, get) => ({
  status: "idle",
  version: null,
  notes: null,
  progress: 0,
  error: null,
  update: null,

  check: async (silent = false) => {
    if (get().status === "checking" || get().status === "downloading") return
    set({ status: "checking", error: null })
    const update = await checkForUpdate()
    if (update) {
      set({
        status: "available",
        update,
        version: update.version,
        notes: update.body ?? null,
      })
    } else {
      // No update, not configured, or running in the browser.
      set({ status: silent ? "idle" : "uptodate" })
    }
  },

  install: async () => {
    const { update } = get()
    if (!update) return
    set({ status: "downloading", progress: 0, error: null })
    try {
      await installAndRelaunch(update, ({ downloaded, total }) => {
        set({ progress: total > 0 ? downloaded / total : 0 })
      })
      // App relaunches on success; nothing else to do.
    } catch (e) {
      set({ status: "error", error: e instanceof Error ? e.message : "Update failed" })
    }
  },
}))
