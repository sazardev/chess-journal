import { useMemo, useState } from "react"
import {
  PUZZLES,
  DIFFICULTY_ORDER,
  DIFFICULTY_LABEL,
  type Puzzle,
  type PuzzleDifficulty,
} from "../data/puzzles"
import { usePuzzleStore } from "../stores/usePuzzleStore"
import { usePuzzleProgressStore } from "../stores/usePuzzleProgressStore"

function fmtTime(ms: number): string {
  const total = Math.floor(ms / 1000)
  const m = Math.floor(total / 60)
  const s = total % 60
  return m > 0 ? `${m}:${String(s).padStart(2, "0")}` : `${s}s`
}

type Filter = "all" | "unsolved" | "solved"

interface Props {
  onStart: (queue: Puzzle[], index: number) => void
}

export default function PuzzleList({ onStart }: Props) {
  const [search, setSearch] = useState("")
  const [diff, setDiff] = useState<"all" | PuzzleDifficulty>("all")
  const [filter, setFilter] = useState<Filter>("all")

  const progress = usePuzzleProgressStore((s) => s.progress)
  const activeId = usePuzzleStore((s) => s.puzzle?.id)

  const solvedCount = useMemo(
    () => PUZZLES.filter((p) => progress[p.id]?.solved).length,
    [progress],
  )

  const list = useMemo(() => {
    const q = search.toLowerCase().trim()
    return PUZZLES.filter((p) => {
      if (diff !== "all" && p.difficulty !== diff) return false
      const solved = !!progress[p.id]?.solved
      if (filter === "solved" && !solved) return false
      if (filter === "unsolved" && solved) return false
      if (!q) return true
      return (
        p.title.toLowerCase().includes(q) ||
        p.source.toLowerCase().includes(q) ||
        p.theme.toLowerCase().includes(q) ||
        p.difficulty.includes(q)
      )
    })
  }, [search, diff, filter, progress])

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex items-center gap-1 px-3 pb-1.5 pt-1.5">
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Title, player, theme..."
          className="flex-1 bg-gray-50 font-mono text-[10px] outline-none placeholder:text-gray-300 text-black px-1.5 py-0.5"
        />
        <span className="font-mono text-[9px] tabular-nums text-gray-300">
          {solvedCount}/{PUZZLES.length}
        </span>
      </div>

      <div className="flex flex-wrap items-center gap-1 px-3 pb-1.5">
        {(["all", "unsolved", "solved"] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`font-mono text-[8px] uppercase tracking-[0.08em] px-1.5 py-0.5 transition-colors ${
              filter === f ? "bg-black text-white" : "text-gray-400 hover:text-black hover:bg-gray-100"
            }`}
          >
            {f}
          </button>
        ))}
        <span className="mx-0.5 h-3 w-px bg-gray-100" />
        <button
          onClick={() => setDiff("all")}
          className={`font-mono text-[8px] uppercase tracking-[0.08em] px-1.5 py-0.5 transition-colors ${
            diff === "all" ? "bg-black text-white" : "text-gray-400 hover:text-black hover:bg-gray-100"
          }`}
        >
          All
        </button>
        {DIFFICULTY_ORDER.map((d) => (
          <button
            key={d}
            onClick={() => setDiff(d)}
            className={`font-mono text-[8px] uppercase tracking-[0.08em] px-1.5 py-0.5 transition-colors ${
              diff === d ? "bg-black text-white" : "text-gray-400 hover:text-black hover:bg-gray-100"
            }`}
          >
            {DIFFICULTY_LABEL[d]}
          </button>
        ))}
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-3 pb-2">
        {list.length === 0 && (
          <p className="py-4 text-center font-mono text-[10px] text-gray-300">No puzzles</p>
        )}
        {list.map((p, i) => {
          const r = progress[p.id]
          const active = activeId === p.id
          return (
            <button
              key={p.id}
              onClick={() => onStart(list, i)}
              className={`group -mx-2 block w-full px-2 py-1.5 text-left transition-colors hover:bg-gray-50 ${
                active ? "bg-gray-100" : ""
              }`}
            >
              <div className="flex items-center gap-1.5">
                <span className="shrink-0 font-mono text-[9px] leading-none text-black w-2">
                  {r?.solved ? (r.cleanSolve ? "♦" : "✓") : ""}
                </span>
                <span className="truncate font-mono text-[10px] md:text-[11px] text-black">
                  {p.title}
                </span>
                {active && <span className="shrink-0 text-[8px] text-gray-400">active</span>}
              </div>
              <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 pl-3.5 font-mono text-[8px] text-gray-400">
                <span className="uppercase tracking-[0.08em] text-gray-300">
                  {DIFFICULTY_LABEL[p.difficulty]}
                </span>
                <span className="tabular-nums">Mate in {p.mateIn}</span>
                {p.source && <span className="truncate max-w-[120px] text-gray-400">{p.source}</span>}
                {r?.solved && (
                  <span className="tabular-nums text-gray-500">{fmtTime(r.bestTimeMs)}</span>
                )}
              </div>
            </button>
          )
        })}
      </div>
    </div>
  )
}
