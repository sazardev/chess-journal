import { useOpeningStore } from "../stores/useOpeningStore"
import { useConfigStore } from "../stores/useConfigStore"

export default function OpeningChip() {
  const enabled = useConfigStore((s) => s.openingAnalyzer)
  const current = useOpeningStore((s) => s.current)

  if (!enabled || !current) return null
  const move = Math.ceil(current.lastBookPly / 2)

  return (
    <div className="flex items-center gap-1.5 border-b border-gray-100 px-3 py-1.5">
      <span className="shrink-0 font-mono text-[9px] tabular-nums text-gray-400">{current.eco}</span>
      <span className="truncate font-mono text-[10px] text-black" title={current.name}>
        {current.name}
      </span>
      <span className="ml-auto shrink-0 font-mono text-[8px] uppercase tracking-[0.1em] text-gray-300">
        book→{move}
      </span>
    </div>
  )
}
