import { useMemo } from "react"
import { useLibraryStore } from "../stores/useLibraryStore"
import { aggregateOpenings } from "../lib/openingStats"

interface Props {
  onSelect: (name: string) => void
  onClose: () => void
}

export default function OpeningStats({ onSelect, onClose }: Props) {
  const entries = useLibraryStore((s) => s.entries)
  const stats = useMemo(() => aggregateOpenings(entries), [entries])

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-[#00000033] p-4"
      onClick={onClose}
    >
      <div
        className="flex max-h-[80vh] w-full max-w-md flex-col bg-white shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-gray-100 px-4 py-3">
          <span className="font-mono text-[10px] uppercase tracking-[0.15em] text-gray-400">
            Openings — by your games
          </span>
          <button
            onClick={onClose}
            className="font-mono text-sm leading-none text-gray-400 transition-colors hover:text-black"
            aria-label="Close"
          >
            ×
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto">
          {stats.length === 0 && (
            <p className="py-8 text-center font-mono text-[10px] text-gray-300">No games yet</p>
          )}
          {stats.map((s) => (
            <button
              key={s.name}
              onClick={() => onSelect(s.name)}
              className="flex w-full items-center gap-2 border-b border-gray-50 px-4 py-2 text-left transition-colors hover:bg-gray-50"
              title="Filter library to this opening"
            >
              <span className="w-8 shrink-0 font-mono text-[9px] tabular-nums text-gray-300">{s.eco}</span>
              <span className="min-w-0 flex-1">
                <span className="block truncate font-mono text-[11px] text-black">{s.name}</span>
                <span className="font-mono text-[8px] uppercase tracking-[0.08em] text-gray-400">
                  {s.games} game{s.games !== 1 ? "s" : ""}
                  {s.avgBook > 0 && <> · book→{s.avgBook}</>}
                  {s.avgMoves > 0 && <> · ~{s.avgMoves} moves</>}
                </span>
              </span>
              {s.rated > 0 && (
                <span className="shrink-0 font-mono text-[10px] tabular-nums text-gray-500">
                  {s.wins}-{s.losses}-{s.draws}
                </span>
              )}
            </button>
          ))}
        </div>

        {stats.length > 0 && (
          <div className="border-t border-gray-100 px-4 py-2">
            <p className="font-mono text-[8px] text-gray-300">
              W-L-D shown for games with a result and your color set (edit in a game's Advanced panel).
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
