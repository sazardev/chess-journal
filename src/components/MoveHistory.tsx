import { useRef, useEffect } from "react"
import { useGameStore } from "../stores/useGameStore"

export default function MoveHistory() {
  const history = useGameStore((s) => s.history)
  const historyIndex = useGameStore((s) => s.historyIndex)
  const goToMove = useGameStore((s) => s.goToMove)
  const goToStart = useGameStore((s) => s.goToStart)
  const goToEnd = useGameStore((s) => s.goToEnd)
  const goBack = useGameStore((s) => s.goBack)
  const goForward = useGameStore((s) => s.goForward)

  const listRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (listRef.current) {
      listRef.current.scrollTop = listRef.current.scrollHeight
    }
  }, [history.length])

  const pairs: { white?: (typeof history)[0]; black?: (typeof history)[0] }[] = []
  for (let i = 0; i < history.length; i += 2) {
    pairs.push({
      white: history[i],
      black: history[i + 1],
    })
  }

  return (
    <div className="flex h-full flex-col border-r border-border">
      <div className="flex items-center justify-between border-b border-border px-3 py-1.5">
        <span className="font-mono text-[9px] uppercase tracking-[0.15em] text-text-secondary">
          History
        </span>
        <div className="flex gap-0.5">
          <button
            onClick={goToStart}
            className="px-1.5 py-0.5 font-mono text-[10px] text-text-secondary transition-colors hover:text-text-primary"
            title="Start"
          >
            |◁
          </button>
          <button
            onClick={goBack}
            className="px-1.5 py-0.5 font-mono text-[10px] text-text-secondary transition-colors hover:text-text-primary"
            title="Back"
          >
            ◁
          </button>
          <button
            onClick={goForward}
            className="px-1.5 py-0.5 font-mono text-[10px] text-text-secondary transition-colors hover:text-text-primary"
            title="Forward"
          >
            ▷
          </button>
          <button
            onClick={goToEnd}
            className="px-1.5 py-0.5 font-mono text-[10px] text-text-secondary transition-colors hover:text-text-primary"
            title="End"
          >
            ▷|
          </button>
        </div>
      </div>

      <div ref={listRef} className="flex-1 overflow-y-auto px-2 py-1">
        {pairs.length === 0 && (
          <p className="px-1 py-4 text-center font-mono text-[10px] text-text-secondary/40">
            No moves yet
          </p>
        )}

        {pairs.map((pair, i) => {
          const moveNum = i + 1
          const whiteIdx = i * 2
          const blackIdx = whiteIdx + 1

          return (
            <div
              key={moveNum}
              className="flex items-center font-mono text-xs leading-relaxed"
            >
              <span className="w-6 text-right text-text-secondary/50 tabular-nums">
                {moveNum}.
              </span>

              <button
                onClick={() => goToMove(whiteIdx + 1)}
                className={`ml-1 rounded px-1 tabular-nums transition-colors hover:bg-mono-100 dark:hover:bg-mono-800 ${
                  historyIndex === whiteIdx + 1
                    ? "bg-text-primary text-surface"
                    : "text-text-primary"
                }`}
              >
                {pair.white!.san}
              </button>

              {pair.black && (
                <button
                  onClick={() => goToMove(blackIdx + 1)}
                  className={`ml-1 rounded px-1 tabular-nums transition-colors hover:bg-mono-100 dark:hover:bg-mono-800 ${
                    historyIndex === blackIdx + 1
                      ? "bg-text-primary text-surface"
                      : "text-text-primary"
                  }`}
                >
                  {pair.black.san}
                </button>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
