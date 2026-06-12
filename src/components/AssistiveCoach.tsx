import { useMemo } from "react"
import { useGameStore, START_FEN } from "../stores/useGameStore"
import { useAnalysisStore } from "../stores/useAnalysisStore"
import { useConfigStore } from "../stores/useConfigStore"
import { useAssistiveStore } from "../stores/useAssistiveStore"
import { useOpeningStore } from "../stores/useOpeningStore"
import { nagColor, type Nag } from "../lib/moveQuality"
import { buildGameReport } from "../lib/gameReport"
import type { ExplainTone } from "../lib/explain"
import type { AssistiveFeedback } from "../stores/useAssistiveStore"

function toneColor(tone: ExplainTone): string {
  switch (tone) {
    case "blunder":    return "#dc2626"
    case "mistake":    return "#ea580c"
    case "inaccuracy": return "#a3a3a3"
    case "good":       return "#16a34a"
    case "book":       return "#9ca3af"
    default:           return "#6b7280"
  }
}

/** Short grade label for a move, refined by NAG for the good cases. */
function gradeLabel(fb: AssistiveFeedback): string {
  switch (fb.tone) {
    case "blunder":    return "Blunder"
    case "mistake":    return "Mistake"
    case "inaccuracy": return "Inaccuracy"
    case "book":       return "Book"
    case "good":       return fb.nag === "!!" ? "Brilliant" : "Great move"
    default:           return "Solid"
  }
}

const NAG_ORDER: Nag[] = ["!!", "!", "?!", "?", "??"]

export default function AssistiveCoach() {
  const feedbackByPly = useAssistiveStore((s) => s.feedbackByPly)
  const lastPlayerPly = useAssistiveStore((s) => s.lastPlayerPly)
  const turn = useAssistiveStore((s) => s.turn)
  const engineThinking = useAssistiveStore((s) => s.engineThinking)

  const goToMove = useGameStore((s) => s.goToMove)
  const history = useGameStore((s) => s.fullHistory)
  const startFen = useGameStore((s) => s.startFen)
  const byFen = useAnalysisStore((s) => s.byFen)
  const assistiveColor = useConfigStore((s) => s.assistiveColor)
  const current = useOpeningStore((s) => s.current)
  const openingName = current?.name ?? null

  const fb = lastPlayerPly != null ? feedbackByPly[lastPlayerPly] : undefined

  // Performance for the player's side — derived from the SAME engine scan and
  // Lichess accuracy curves the Game report uses, so the two never disagree.
  const bookPlies = startFen !== START_FEN ? 0 : current?.lastBookPly ?? 0
  const report = useMemo(
    () => buildGameReport(history, byFen, { bookPlies }),
    [history, byFen, bookPlies],
  )
  const side = assistiveColor === "white" ? report.white : report.black

  // NAG tallies for the player's own moves (the good marks aren't in SideReport).
  const counts = useMemo(() => {
    const c: Record<Nag, number> = { "!!": 0, "!": 0, "?!": 0, "?": 0, "??": 0 }
    for (const f of Object.values(feedbackByPly)) if (f.nag) c[f.nag]++
    return c
  }, [feedbackByPly])

  const color = fb ? toneColor(fb.tone) : "#6b7280"
  const showAlternative = !!fb?.bestSan && fb.cpLoss > 30 && fb.tone !== "book"

  const status = engineThinking
    ? "Engine thinking…"
    : turn === "engine"
      ? "Engine's turn"
      : turn === "player"
        ? "Your move"
        : "Ready"

  return (
    <div className="border-t border-gray-100 px-3 md:px-4 py-2 md:py-2.5 flex flex-col gap-1.5">
      {/* Header: status + opening */}
      <div className="flex items-center justify-between gap-2">
        <span className="font-mono text-[8px] uppercase tracking-[0.15em] text-gray-400">
          Coach
        </span>
        <span className="font-mono text-[9px] tabular-nums text-gray-500 flex items-center gap-1.5">
          {engineThinking && (
            <span className="h-1 w-1 rounded-full bg-gray-400 animate-pulse" />
          )}
          {status}
        </span>
      </div>

      {/* Live move grade */}
      {fb ? (
        <div className="flex items-start gap-2">
          <span
            className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full"
            style={{ backgroundColor: color }}
          />
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5 flex-wrap leading-tight">
              <span className="font-mono text-[10px] font-medium text-gray-800 tabular-nums">
                {fb.san}
              </span>
              {fb.nag && (
                <span
                  className="font-mono text-[11px] font-bold leading-none"
                  style={{ color: nagColor(fb.nag) }}
                >
                  {fb.nag}
                </span>
              )}
              <span
                className="font-mono text-[9px] uppercase tracking-[0.08em]"
                style={{ color }}
              >
                {gradeLabel(fb)}
              </span>
            </div>
            <p className="mt-0.5 font-mono text-[10px] leading-snug text-gray-600">
              {fb.text}
            </p>
            {showAlternative && (
              <button
                onClick={() => goToMove(fb.ply)}
                className="mt-1 inline-flex items-center gap-1 font-mono text-[9px] text-gray-400 hover:text-black transition-colors"
                title="Step back to review this position"
              >
                <span
                  className="h-1.5 w-1.5 rounded-full"
                  style={{ backgroundColor: "rgba(120,120,120,0.9)" }}
                />
                Better:{" "}
                <span className="text-gray-700 font-medium">{fb.bestSan}</span>
                {fb.cpLoss > 0 && (
                  <span className="text-gray-400">
                    ({(fb.cpLoss / 100).toFixed(1)})
                  </span>
                )}
                <span className="text-gray-300 underline underline-offset-2">review</span>
              </button>
            )}
          </div>
        </div>
      ) : (
        <p className="font-mono text-[10px] text-gray-400 leading-snug">
          {openingName
            ? `In book — ${openingName}.`
            : "Make a move — I'll grade it and show the best alternative."}
        </p>
      )}

      {/* Per-game performance — same source as the Game report */}
      {side.scored > 0 && (
        <div className="mt-0.5 flex items-center justify-between border-t border-gray-100 pt-1.5">
          <div className="flex items-baseline gap-1">
            <span className="font-mono text-[8px] uppercase tracking-[0.1em] text-gray-400">
              Accuracy
            </span>
            <span className="font-mono text-[11px] font-medium tabular-nums text-gray-800">
              {side.accuracy.toFixed(0)}%
            </span>
            {side.estimatedElo && (
              <span className="font-mono text-[8px] tabular-nums text-gray-400">
                {side.estimatedElo.band}
              </span>
            )}
          </div>
          <div className="flex items-center gap-1.5">
            {NAG_ORDER.map((n) =>
              counts[n] > 0 ? (
                <span key={n} className="flex items-center gap-0.5">
                  <span
                    className="font-mono text-[10px] font-bold leading-none"
                    style={{ color: nagColor(n) }}
                  >
                    {n}
                  </span>
                  <span className="font-mono text-[9px] tabular-nums text-gray-400">
                    {counts[n]}
                  </span>
                </span>
              ) : null,
            )}
          </div>
        </div>
      )}
    </div>
  )
}
