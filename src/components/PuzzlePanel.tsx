import { useEffect, useState } from "react"
import { usePuzzleStore } from "../stores/usePuzzleStore"
import { usePuzzleProgressStore } from "../stores/usePuzzleProgressStore"
import { DIFFICULTY_LABEL } from "../data/puzzles"

function fmtTime(ms: number): string {
  const total = Math.floor(ms / 1000)
  const m = Math.floor(total / 60)
  const s = total % 60
  return m > 0 ? `${m}:${String(s).padStart(2, "0")}` : `${s}s`
}

export default function PuzzlePanel() {
  const puzzle = usePuzzleStore((s) => s.puzzle)
  const status = usePuzzleStore((s) => s.status)
  const mistakes = usePuzzleStore((s) => s.mistakes)
  const solutionIndex = usePuzzleStore((s) => s.solutionIndex)
  const elapsedMs = usePuzzleStore((s) => s.elapsedMs)
  const startedAt = usePuzzleStore((s) => s.startedAt)
  const hasNext = usePuzzleStore((s) => s.hasNext)
  const retry = usePuzzleStore((s) => s.retry)
  const next = usePuzzleStore((s) => s.next)
  const exit = usePuzzleStore((s) => s.exit)

  const result = usePuzzleProgressStore((s) => (puzzle ? s.progress[puzzle.id] : undefined))

  // Live timer while solving; frozen elapsed once solved.
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    if (status !== "playing") return
    const t = setInterval(() => setNow(Date.now()), 250)
    return () => clearInterval(t)
  }, [status, puzzle?.id])

  if (!puzzle) return null

  const liveMs = status === "solved" ? elapsedMs : Math.max(0, now - startedAt)
  const movesDone = Math.floor(solutionIndex / 2)
  const sideToMove = puzzle.playerColor === "w" ? "White" : "Black"

  const chip = "font-mono text-[8px] uppercase tracking-[0.12em] text-gray-400"
  const value = "font-mono text-[13px] tabular-nums text-black"

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex items-center justify-between px-3 py-2 border-b border-gray-100">
        <span className="font-mono text-[10px] uppercase tracking-[0.15em] text-gray-400">
          Puzzle
        </span>
        <div className="flex items-center gap-3">
          <span className="font-mono text-[9px] uppercase tracking-[0.1em] text-gray-300">
            {DIFFICULTY_LABEL[puzzle.difficulty]}
          </span>
          <button
            onClick={exit}
            className="font-mono text-[10px] uppercase tracking-[0.1em] text-gray-400 hover:text-black transition-colors"
          >
            Exit
          </button>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-3 py-3">
        <h2 className="font-mono text-[13px] text-black leading-tight">{puzzle.title}</h2>
        {puzzle.source && (
          <p className="mt-0.5 font-mono text-[9px] text-gray-400">{puzzle.source}</p>
        )}
        <p className="mt-2 font-mono text-[11px] text-gray-600 leading-snug">
          {puzzle.description}
        </p>

        <div className="mt-4 grid grid-cols-3 gap-2 border-t border-gray-100 pt-3">
          <div className="flex flex-col gap-0.5">
            <span className={chip}>To move</span>
            <span className={value}>{sideToMove}</span>
          </div>
          <div className="flex flex-col gap-0.5">
            <span className={chip}>Time</span>
            <span className={value}>{fmtTime(liveMs)}</span>
          </div>
          <div className="flex flex-col gap-0.5">
            <span className={chip}>Mistakes</span>
            <span className={value}>{mistakes}</span>
          </div>
          <div className="flex flex-col gap-0.5">
            <span className={chip}>Steps</span>
            <span className={value}>{movesDone}/{puzzle.mateIn}</span>
          </div>
          <div className="col-span-2 flex flex-col gap-0.5">
            <span className={chip}>Objective</span>
            <span className="font-mono text-[11px] text-black">Mate in {puzzle.mateIn}</span>
          </div>
        </div>

        {status === "solved" && (
          <div className="mt-4 border border-black px-3 py-2.5">
            <div className="flex items-center justify-between">
              <span className="font-mono text-[11px] uppercase tracking-[0.15em] text-black">
                Solved
              </span>
              {mistakes === 0 && (
                <span className="font-mono text-[8px] uppercase tracking-[0.1em] text-gray-500">
                  Clean
                </span>
              )}
            </div>
            <p className="mt-1 font-mono text-[10px] text-gray-500 leading-snug">
              {puzzle.mateIn} {puzzle.mateIn === 1 ? "move" : "moves"} · {fmtTime(liveMs)} ·{" "}
              {mistakes} {mistakes === 1 ? "mistake" : "mistakes"}
            </p>
          </div>
        )}

        {result && (
          <div className="mt-3 flex items-center gap-3 border-t border-gray-100 pt-3">
            <span className={chip}>Best</span>
            <span className="font-mono text-[10px] tabular-nums text-gray-500">
              {fmtTime(result.bestTimeMs)}
            </span>
            <span className="font-mono text-[10px] tabular-nums text-gray-500">
              {result.bestMistakes} {result.bestMistakes === 1 ? "miss" : "misses"}
            </span>
            {result.cleanSolve && (
              <span className="font-mono text-[8px] uppercase tracking-[0.1em] text-gray-400">
                ♦ clean
              </span>
            )}
          </div>
        )}
      </div>

      <div className="shrink-0 border-t border-gray-100 p-3">
        <div className="flex gap-1.5">
          <button
            onClick={retry}
            className="flex-1 font-mono text-[10px] md:text-[9px] uppercase tracking-[0.12em] py-2.5 md:py-2 text-gray-400 hover:text-black hover:bg-gray-100 transition-colors"
          >
            Reset
          </button>
          <button
            onClick={next}
            disabled={!hasNext}
            className={`flex-1 font-mono text-[10px] md:text-[9px] uppercase tracking-[0.12em] py-2.5 md:py-2 transition-colors disabled:opacity-30 ${
              status === "solved"
                ? "bg-black text-white hover:bg-gray-800"
                : "text-gray-400 hover:text-black hover:bg-gray-100"
            }`}
          >
            Next
          </button>
        </div>
      </div>
    </div>
  )
}
