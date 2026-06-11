import { useEffect, useMemo, useRef, useState } from "react"
import { useGameStore, START_FEN } from "../stores/useGameStore"
import { useAnalysisStore } from "../stores/useAnalysisStore"
import { useAiStore } from "../stores/useAiStore"
import { useAiCacheStore, gameCacheKey } from "../stores/useAiCacheStore"
import { useOpeningStore } from "../stores/useOpeningStore"
import { getOpeningsCache, detectOpening } from "../lib/openings"
import { buildGameReport, type SideReport } from "../lib/gameReport"
import { buildGameContext } from "../lib/ai/explainContext"
import { templateExplainer } from "../lib/ai/explainer"
import { useExplainer } from "../hooks/useExplainer"

interface Props {
  onClose: () => void
}

const PHASE_LABEL = { opening: "opening", middlegame: "middlegame", endgame: "endgame" } as const

export default function GameReport({ onClose }: Props) {
  const history = useGameStore((s) => s.fullHistory)
  const startFen = useGameStore((s) => s.startFen)
  const goToMove = useGameStore((s) => s.goToMove)
  const byFen = useAnalysisStore((s) => s.byFen)
  const current = useOpeningStore((s) => s.current)

  // Opening theory shouldn't count against the player. Custom start positions
  // have no book.
  const bookPlies = useMemo(() => {
    if (startFen !== START_FEN) return 0
    if (current) return current.lastBookPly
    const cache = getOpeningsCache()
    return cache ? (detectOpening(history, cache)?.lastBookPly ?? 0) : 0
  }, [startFen, current, history])

  const report = useMemo(
    () => buildGameReport(history, byFen, { bookPlies }),
    [history, byFen, bookPlies],
  )

  const openingName = startFen === START_FEN ? (current?.name ?? null) : null
  const explainer = useExplainer()
  const isLlm = explainer.kind === "llm"

  // Instant Tier 0 summary — also the placeholder/fallback while the LLM streams.
  const templateSummary = useMemo(
    () => (report.coveredPlies > 0 ? templateExplainer.explainGame(buildGameContext(report, openingName)) : ""),
    [report, openingName],
  )
  const [llmText, setLlmText] = useState("")
  const [streaming, setStreaming] = useState(false)

  // Read the report via a ref (kept fresh in an effect, not during render) so the
  // live engine deepening its evals doesn't restart generation. `reportReady` is a
  // stable boolean: fires once when coverage lands, never on deepening.
  const reportRef = useRef(report)
  useEffect(() => {
    reportRef.current = report
  }, [report])
  const reportReady = report.coveredPlies > 0

  useEffect(() => {
    if (!isLlm || !reportReady) return
    let cancelled = false
    // setState happens inside this async fn (not synchronously in the effect body).
    const run = async () => {
      const key = gameCacheKey(
        useAiStore.getState().modelId,
        history.map((m) => m.lan),
        reportRef.current.coveredPlies,
      )
      const cached = useAiCacheStore.getState().games[key]
      if (cached) {
        // Already generated for this game/coverage → show it instantly.
        setLlmText(cached)
        setStreaming(false)
        return
      }
      const ctx = buildGameContext(reportRef.current, openingName)
      setStreaming(true)
      setLlmText("")
      let acc = ""
      try {
        const full = await explainer.streamGame(ctx, (tok) => {
          if (cancelled) return
          acc += tok
          setLlmText(acc)
        })
        if (!cancelled) {
          const text = full || acc
          setLlmText(text)
          if (text) useAiCacheStore.getState().setGame(key, text)
        }
      } catch {
        if (!cancelled) setLlmText("") // fall back to the template summary
      } finally {
        if (!cancelled) setStreaming(false)
      }
    }
    run()
    return () => {
      cancelled = true
    }
  }, [isLlm, reportReady, openingName, explainer, history])

  const summary = isLlm && llmText ? llmText : templateSummary

  const jump = (ply: number) => {
    goToMove(ply + 1)
    onClose()
  }

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/20 p-4"
      onClick={onClose}
    >
      <div
        className="flex max-h-[80vh] w-full max-w-md flex-col bg-white shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-gray-100 px-4 py-3">
          <span className="font-mono text-[10px] uppercase tracking-[0.15em] text-gray-400">
            Game report
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
          {report.coveredPlies === 0 ? (
            <p className="py-8 text-center font-mono text-[10px] text-gray-300">
              Not analyzed yet — turn the engine on and run “Analyze game”.
            </p>
          ) : (
            <>
              {(summary || streaming) && (
                <p className="border-b border-gray-100 px-4 py-3 font-mono text-[10px] leading-relaxed text-black">
                  {summary}
                  {streaming && <span className="text-gray-300"> ▍</span>}
                </p>
              )}

              <div className="grid grid-cols-2 border-b border-gray-100">
                <SideColumn title="White" side={report.white} />
                <SideColumn title="Black" side={report.black} className="border-l border-gray-100" />
              </div>

              <div className="border-b border-gray-100 px-4 py-2">
                <p className="font-mono text-[8px] uppercase tracking-[0.1em] text-gray-400">
                  Analyzed {report.coveredPlies}/{report.totalPlies} plies
                  {report.weakestPhase && <> · weakest: {PHASE_LABEL[report.weakestPhase]}</>}
                </p>
              </div>

              <div className="px-4 py-3">
                <p className="mb-2 font-mono text-[9px] uppercase tracking-[0.12em] text-gray-400">
                  Improvement points
                </p>
                {report.improvements.length === 0 ? (
                  <p className="font-mono text-[10px] text-gray-300">No major mistakes — clean game.</p>
                ) : (
                  <div className="flex flex-col gap-0.5">
                    {report.improvements.map((imp) => (
                      <button
                        key={imp.ply}
                        onClick={() => jump(imp.ply)}
                        className="flex items-baseline gap-2 px-1 py-1 text-left transition-colors hover:bg-gray-50"
                        title="Go to this move"
                      >
                        <span className="w-12 shrink-0 font-mono text-[10px] tabular-nums text-gray-500">
                          {moveLabel(imp.ply)} {imp.san}
                        </span>
                        <span className="min-w-0 flex-1 truncate font-mono text-[10px] text-black">
                          {imp.note}
                        </span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </>
          )}
        </div>

        <div className="border-t border-gray-100 px-4 py-2">
          <p className="font-mono text-[8px] leading-snug text-gray-300">
            Accuracy &amp; ACPL come from the engine scan. The rating is a rough estimate from average
            centipawn loss — not a measured Elo.
          </p>
        </div>
      </div>
    </div>
  )
}

/** "12." for a White move, "12…" for a Black move (1-based move number). */
function moveLabel(ply: number): string {
  const moveNum = Math.floor(ply / 2) + 1
  return ply % 2 === 0 ? `${moveNum}.` : `${moveNum}…`
}

function SideColumn({
  title,
  side,
  className = "",
}: {
  title: string
  side: SideReport
  className?: string
}) {
  return (
    <div className={`flex flex-col gap-1.5 px-4 py-3 ${className}`}>
      <span className="font-mono text-[9px] uppercase tracking-[0.12em] text-gray-400">{title}</span>
      <Row label="Accuracy" value={side.scored ? `${side.accuracy.toFixed(1)}%` : "—"} />
      <Row label="ACPL" value={side.scored ? String(side.acpl) : "—"} />
      <Row label="Est. rating" value={side.estimatedElo ? side.estimatedElo.band : "—"} />
      <Row label="Blunders" value={String(side.blunders)} />
      <Row label="Mistakes" value={String(side.mistakes)} />
      <Row label="Inaccuracies" value={String(side.inaccuracies)} />
    </div>
  )
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-2">
      <span className="font-mono text-[9px] text-gray-400">{label}</span>
      <span className="font-mono text-[11px] tabular-nums text-black">{value}</span>
    </div>
  )
}
