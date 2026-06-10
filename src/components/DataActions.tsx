import { useCallback, useState } from "react"
import { useLibraryStore } from "../stores/useLibraryStore"
import { usePersistenceStore } from "../stores/usePersistenceStore"
import { useGameStore } from "../stores/useGameStore"
import { useMetaStore } from "../stores/useMetaStore"
import { useBoardStore } from "../stores/useBoardStore"
import { useSaveStore } from "../stores/useSaveStore"
import { useAnalysisStore } from "../stores/useAnalysisStore"
import { usePuzzleStore } from "../stores/usePuzzleStore"
import { usePuzzleProgressStore } from "../stores/usePuzzleProgressStore"

type Action = "library" | "autosave" | "all"

/** Data-management rows with two-step confirmation. Shared by the desktop
 * Settings modal and the mobile Settings page. `onErased` fires after a full
 * wipe so the host can dismiss itself. */
export default function DataActions({ onErased }: { onErased?: () => void }) {
  const count = useLibraryStore((s) => s.entries.length)
  const [armed, setArmed] = useState<Action | null>(null)
  const [busy, setBusy] = useState(false)

  const run = useCallback(
    async (action: Action) => {
      if (armed !== action) {
        setArmed(action)
        return
      }
      setBusy(true)
      if (action === "library") {
        await useLibraryStore.getState().clear()
      } else if (action === "autosave") {
        await usePersistenceStore.getState().clearAutosave()
      } else {
        // Reset the working game FIRST so nothing gets re-committed into the
        // library we're about to wipe.
        usePuzzleStore.getState().exit()
        useGameStore.getState().reset()
        useMetaStore.getState().reset()
        useBoardStore.getState().clearAll()
        useAnalysisStore.getState().clear()
        await usePersistenceStore.getState().clearAll()
        useLibraryStore.setState({ entries: [] })
        usePuzzleProgressStore.setState({ progress: {} })
        useSaveStore.getState().markIdle()
      }
      setBusy(false)
      setArmed(null)
      if (action === "all") onErased?.()
    },
    [armed, onErased],
  )

  const row = (action: Action, title: string, desc: string, danger = false) => {
    const isArmed = armed === action
    return (
      <div className="flex items-center justify-between gap-3 py-3">
        <div className="min-w-0">
          <p className="font-mono text-[11px] text-black">{title}</p>
          <p className="font-mono text-[9px] text-gray-400 leading-snug">{desc}</p>
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
          {isArmed && (
            <button
              onClick={() => setArmed(null)}
              disabled={busy}
              className="font-mono text-[9px] uppercase tracking-[0.1em] px-2 py-2 text-gray-400 hover:text-black transition-colors"
            >
              Cancel
            </button>
          )}
          <button
            onClick={() => run(action)}
            disabled={busy}
            className={`font-mono text-[9px] uppercase tracking-[0.1em] px-3 py-2 transition-colors disabled:opacity-30 ${
              isArmed ? "bg-black text-white" : "text-gray-400 hover:text-black hover:bg-gray-100"
            }`}
          >
            {isArmed ? "Confirm?" : danger ? "Erase" : "Clear"}
          </button>
        </div>
      </div>
    )
  }

  return (
    <>
      <div className="divide-y divide-gray-100">
        {row("library", `Empty library (${count})`, "Remove all saved games. Cannot be undone.")}
        {row("autosave", "Clear autosave", "Discard the in-progress restore snapshot.")}
        {row("all", "Erase everything", "Delete all games and autosave, then start fresh.", true)}
      </div>
      <p className="pt-3 font-mono text-[8px] text-gray-300 leading-snug">
        Preferences (orientation, autoplay speed) are kept.
      </p>
    </>
  )
}
