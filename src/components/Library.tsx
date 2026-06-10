import { useCallback, useState } from "react"
import type { Square } from "chess.js"
import { useLibraryStore } from "../stores/useLibraryStore"
import { useGameStore } from "../stores/useGameStore"
import { useBoardStore } from "../stores/useBoardStore"
import { useMetaStore } from "../stores/useMetaStore"

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return "now"
  if (mins < 60) return `${mins}m ago`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  if (days < 7) return `${days}d ago`
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" })
}

interface Props {
  open: boolean
  onToggle: () => void
}

export default function Library({ open, onToggle }: Props) {
  const entries = useLibraryStore((s) => s.entries)
  const removeEntry = useLibraryStore((s) => s.removeEntry)
  const [loadedId, setLoadedId] = useState<string | null>(null)

  const handleLoad = useCallback(
    (entryId: string) => {
      const state = useLibraryStore.getState()
      const entry = state.entries.find((e) => e.id === entryId)
      if (!entry) {
        console.error("[Library] entry not found:", entryId, "available:", state.entries.map((e) => e.id))
        return
      }

      console.log("[Library] loading entry:", entry.id, entry.data.meta.name, entry.data.game.fullHistory.length, "moves")

      const { game, board } = entry.data

      if (!game || !game.fullHistory) {
        console.error("[Library] invalid game data in entry:", entry)
        return
      }

      try {
        useGameStore.getState().restoreState({ ...game, currentLibraryId: entryId })
        console.log("[Library] restoreState done, fen:", useGameStore.getState().fen)
      } catch (err) {
        console.error("[Library] restoreState error:", err)
        return
      }

      useMetaStore.getState().load(entry.data.meta)

      const b = useBoardStore.getState()
      b.clearAll()
      for (const a of board?.arrows ?? []) {
        b.addArrow(a.from as Square, a.to as Square)
      }
      for (const [sq, color] of Object.entries(board?.highlights ?? {})) {
        b.highlightSquare(sq as Square, color)
      }

      setLoadedId(entryId)
      setTimeout(() => setLoadedId(null), 1200)
    },
    [],
  )

  const handleDelete = useCallback(
    (e: React.MouseEvent, id: string) => {
      e.stopPropagation()
      removeEntry(id)
      if (useGameStore.getState().currentLibraryId === id) {
        useGameStore.setState({ currentLibraryId: null })
      }
    },
    [removeEntry],
  )

  return (
    <div className="relative flex shrink-0 z-30">
      <div
        className={`overflow-hidden transition-all duration-200 ${
          open ? "w-56 md:w-60" : "w-0"
        }`}
      >
        <div className="w-56 md:w-60 h-full flex flex-col bg-white">
          <div className="flex items-center justify-between px-3 py-2">
            <span className="font-mono text-[9px] md:text-[10px] uppercase tracking-[0.15em] text-gray-400">
              Library
            </span>
            <span className="font-mono text-[9px] tabular-nums text-gray-300">
              {entries.length}
            </span>
          </div>

          <div className="flex-1 overflow-y-auto px-3 pb-2">
            {entries.length === 0 && (
              <p className="py-4 text-center font-mono text-[10px] text-gray-300">
                No saved games
              </p>
            )}

            {entries.map((entry) => (
              <button
                key={entry.id}
                onClick={() => handleLoad(entry.id)}
                className={`group w-full text-left px-2 py-1.5 -mx-2 transition-colors hover:bg-gray-50 ${
                  loadedId === entry.id ? "bg-gray-100" : ""
                }`}
              >
                <div className="flex items-start justify-between gap-1">
                  <div className="flex-1 min-w-0">
                    <p className="font-mono text-[10px] md:text-[11px] text-black truncate">
                      {entry.data.meta.name || "Untitled"}
                      {loadedId === entry.id && (
                        <span className="ml-1 text-[8px] text-gray-400 font-normal">loaded</span>
                      )}
                    </p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="font-mono text-[8px] text-gray-400">
                        {relativeTime(entry.savedAt)}
                      </span>
                      <span className="font-mono text-[8px] tabular-nums text-gray-400">
                        {entry.data.game.fullHistory.length} moves
                      </span>
                      {entry.data.meta.rating > 0 && (
                        <span className="font-mono text-[8px] tabular-nums text-gray-300">
                          {entry.data.meta.rating > 0
                            ? "★".repeat(Math.min(5, Math.ceil(entry.data.meta.rating / 2)))
                            : ""}
                        </span>
                      )}
                    </div>
                  </div>
                  <button
                    onClick={(e) => handleDelete(e, entry.id)}
                    className="shrink-0 font-mono text-[10px] text-gray-300 opacity-0 group-hover:opacity-100 hover:text-black transition-all"
                  >
                    ×
                  </button>
                </div>
              </button>
            ))}
          </div>
        </div>
      </div>

      <button
        onClick={onToggle}
        className="shrink-0 w-5 flex flex-col items-center justify-center hover:bg-gray-50 transition-colors group"
      >
        <span className="font-mono text-[10px] text-gray-300 group-hover:text-gray-400 select-none leading-none">
          {open ? "◀" : "▶"}
        </span>
      </button>
    </div>
  )
}
