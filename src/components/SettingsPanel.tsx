import { useCallback, useState } from "react"
import { useLibraryStore } from "../stores/useLibraryStore"
import { usePersistenceStore } from "../stores/usePersistenceStore"
import { useGameStore } from "../stores/useGameStore"
import { useMetaStore } from "../stores/useMetaStore"
import { useBoardStore } from "../stores/useBoardStore"
import { useSaveStore } from "../stores/useSaveStore"
import { useAnalysisStore } from "../stores/useAnalysisStore"

type Action = "library" | "autosave" | "all"

export default function SettingsPanel({ onClose }: { onClose: () => void }) {
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
        useGameStore.getState().reset()
        useMetaStore.getState().reset()
        useBoardStore.getState().clearAll()
        useAnalysisStore.getState().clear()
        await usePersistenceStore.getState().clearAll()
        useLibraryStore.setState({ entries: [] })
        useSaveStore.getState().markIdle()
      }
      setBusy(false)
      setArmed(null)
      if (action === "all") onClose()
    },
    [armed, onClose],
  )

  const row = (
    action: Action,
    title: string,
    desc: string,
    danger = false,
  ) => {
    const isArmed = armed === action
    return (
      <div className="flex items-center justify-between gap-3 py-3">
        <div className="min-w-0">
          <p className={`font-mono text-[11px] ${danger ? "text-black" : "text-black"}`}>
            {title}
          </p>
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
              isArmed
                ? "bg-black text-white"
                : "text-gray-400 hover:text-black hover:bg-gray-100"
            }`}
          >
            {isArmed ? "Confirm?" : danger ? "Erase" : "Clear"}
          </button>
        </div>
      </div>
    )
  }

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/20 p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-sm bg-white shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-gray-100 px-4 py-3">
          <span className="font-mono text-[10px] uppercase tracking-[0.15em] text-gray-400">
            Data
          </span>
          <button
            onClick={onClose}
            className="font-mono text-sm text-gray-400 hover:text-black transition-colors leading-none px-1"
            aria-label="Close"
          >
            ×
          </button>
        </div>

        <div className="divide-y divide-gray-100 px-4">
          {row("library", `Empty library (${count})`, "Remove all saved games. Cannot be undone.")}
          {row("autosave", "Clear autosave", "Discard the in-progress restore snapshot.")}
          {row("all", "Erase everything", "Delete all games and autosave, then start fresh.", true)}
        </div>

        <div className="px-4 py-3">
          <p className="font-mono text-[8px] text-gray-300 leading-snug">
            Preferences (orientation, autoplay speed) are kept.
          </p>
        </div>
      </div>
    </div>
  )
}
