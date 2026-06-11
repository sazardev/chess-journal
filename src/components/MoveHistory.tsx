import { useRef, useEffect, useState, useMemo } from "react"
import { useGameStore } from "../stores/useGameStore"
import { useAnalysisStore, posKey } from "../stores/useAnalysisStore"
import { useAiStore } from "../stores/useAiStore"
import { useAiCacheStore, moveCacheKey } from "../stores/useAiCacheStore"
import { useOpeningStore } from "../stores/useOpeningStore"
import { classifyMove, nagColor, type Nag } from "../lib/moveQuality"
import { detectMotifs, type Motif } from "../lib/motifs"
import { type MoveExplanation, type ExplainTone } from "../lib/explain"
import { buildMoveContext } from "../lib/ai/explainContext"
import { useExplainer } from "../hooks/useExplainer"
import OpeningChip from "./OpeningChip"

/** Display colour for an explanation tone, coherent with the NAG heatmap. */
function toneColor(tone: ExplainTone): string {
  switch (tone) {
    case "blunder":
      return "#dc2626" // red-600
    case "mistake":
      return "#ea580c" // orange-600
    case "inaccuracy":
      return "#a3a3a3" // neutral-400
    case "good":
      return "#16a34a" // green-600
    case "book":
      return "#9ca3af" // gray-400
    default:
      return "#6b7280" // gray-500
  }
}

export default function MoveHistory() {
  const history = useGameStore((s) => s.fullHistory)
  const historyIndex = useGameStore((s) => s.historyIndex)
  const goToMove = useGameStore((s) => s.goToMove)
  const goToStart = useGameStore((s) => s.goToStart)
  const goToEnd = useGameStore((s) => s.goToEnd)
  const goBack = useGameStore((s) => s.goBack)
  const goForward = useGameStore((s) => s.goForward)
  const isPlaying = useGameStore((s) => s.isPlaying)
  const togglePlay = useGameStore((s) => s.togglePlay)
  const playSpeed = useGameStore((s) => s.playSpeed)
  const setPlaySpeed = useGameStore((s) => s.setPlaySpeed)
  const bookmarks = useGameStore((s) => s.bookmarks)
  const toggleBookmark = useGameStore((s) => s.toggleBookmark)
  const comments = useGameStore((s) => s.comments)
  const setComment = useGameStore((s) => s.setComment)

  const markMode = useAnalysisStore((s) => s.markMode)
  const byFen = useAnalysisStore((s) => s.byFen)
  const lastBookPly = useOpeningStore((s) => s.current?.lastBookPly ?? 0)
  const openingName = useOpeningStore((s) => s.current?.name ?? null)
  const explainer = useExplainer()

  const [editingComment, setEditingComment] = useState<number | null>(null)
  const [commentValue, setCommentValue] = useState("")

  const listRef = useRef<HTMLDivElement>(null)
  const activeRef = useRef<HTMLButtonElement>(null)

  // Move-quality marks (!!, !, ?!, ?, ??) computed from cached evals.
  const marks = useMemo(() => {
    const out: Record<number, Nag> = {}
    if (!markMode) return out
    for (let i = 0; i < history.length; i++) {
      const mv = history[i]
      const before = byFen[posKey(mv.before)]
      const after = byFen[posKey(mv.after)]
      if (!before || !after) continue
      const nag = classifyMove(mv.color === "w", before, after, mv.lan)
      if (nag) out[i] = nag
    }
    return out
  }, [markMode, history, byFen])

  // Motifs depend only on the moves, so compute them once — not on every eval
  // update that streams in during a scan.
  const motifsByPly = useMemo(() => {
    const out: Record<number, Motif[]> = {}
    if (!markMode) return out
    for (let i = 0; i < history.length; i++) {
      out[i] = detectMotifs(history[i], history[i - 1])
    }
    return out
  }, [markMode, history])

  // One-line plain-language explanation per move, via the active explainer
  // (Tier 0 templates, or the local LLM when enabled and ready).
  const explanations = useMemo(() => {
    const out: Record<number, MoveExplanation> = {}
    if (!markMode) return out
    for (let i = 0; i < history.length; i++) {
      const mv = history[i]
      const before = byFen[posKey(mv.before)]
      const after = byFen[posKey(mv.after)]
      if (!before && !after) continue
      const ctx = buildMoveContext({
        mv,
        before,
        after,
        motifs: motifsByPly[i] ?? [],
        ply: i,
        totalPlies: history.length,
        lastBookPly,
        openingName,
      })
      const exp = explainer.explainMove(ctx)
      if (exp) out[i] = exp
    }
    return out
  }, [markMode, history, byFen, motifsByPly, lastBookPly, openingName, explainer])

  const isLlm = explainer.kind === "llm"
  const [moveComment, setMoveComment] = useState("")
  const [moveStreaming, setMoveStreaming] = useState(false)

  // Whether the active move has a cached eval — a STABLE trigger (boolean), so the
  // live engine deepening its eval (mutating `byFen` repeatedly) doesn't restart
  // generation. We only (re)generate on navigation or when the eval first lands.
  const genMv = history[historyIndex - 1]
  const activeEvalReady = !!(
    genMv &&
    (byFen[posKey(genMv.before)] || byFen[posKey(genMv.after)])
  )

  // When the LLM is active, stream a prose comment for the *current* move only
  // (debounced; cancelled when you move on). The template line shows meanwhile.
  useEffect(() => {
    if (!isLlm || !markMode || !activeEvalReady) return
    const ply = historyIndex - 1
    const mv = history[ply]
    if (!mv) return
    const key = moveCacheKey(useAiStore.getState().modelId, mv.before, mv.lan)
    const cached = useAiCacheStore.getState().moves[key]
    let cancelled = false
    const timer = setTimeout(() => {
      // Already generated this move before → show it instantly, no inference.
      if (cached !== undefined) {
        setMoveComment(cached)
        setMoveStreaming(false)
        return
      }
      // Read the latest evals now (not as a dep) so deepening doesn't re-fire.
      const bf = useAnalysisStore.getState().byFen
      const before = bf[posKey(mv.before)]
      const after = bf[posKey(mv.after)]
      if (!before && !after) return
      const ctx = buildMoveContext({
        mv,
        before,
        after,
        motifs: motifsByPly[ply] ?? [],
        ply,
        totalPlies: history.length,
        lastBookPly,
        openingName,
      })
      // setState lives inside this callback (not synchronously in the effect body).
      setMoveComment("")
      setMoveStreaming(true)
      let acc = ""
      explainer
        .streamMove(ctx, (tok) => {
          if (!cancelled) {
            acc += tok
            setMoveComment(acc)
          }
        })
        .then((full) => {
          if (cancelled) return
          const text = full || acc
          setMoveComment(text)
          if (text) useAiCacheStore.getState().setMove(key, text)
        })
        .catch(() => {
          if (!cancelled) setMoveComment("")
        })
        .finally(() => {
          if (!cancelled) setMoveStreaming(false)
        })
    }, cached !== undefined ? 0 : 400)
    return () => {
      cancelled = true
      clearTimeout(timer)
    }
  }, [isLlm, markMode, activeEvalReady, historyIndex, history, motifsByPly, lastBookPly, openingName, explainer])

  // Keep the current move in view — works for long games and during playback.
  useEffect(() => {
    activeRef.current?.scrollIntoView({ block: "nearest" })
  }, [historyIndex, history.length])

  const pairs: { white?: (typeof history)[0]; black?: (typeof history)[0] }[] = []
  for (let i = 0; i < history.length; i += 2) {
    pairs.push({
      white: history[i],
      black: history[i + 1],
    })
  }

  const handleSaveComment = (idx: number) => {
    setComment(idx, commentValue)
    setEditingComment(null)
    setCommentValue("")
  }

  const handleStartComment = (idx: number) => {
    setEditingComment(idx)
    setCommentValue(comments[idx] ?? "")
  }

  const atEnd = historyIndex >= history.length
  const activePly = historyIndex - 1
  const activeExp = explanations[activePly]
  // On the active move, prefer the streamed LLM comment once it has text; the
  // template line is the instant placeholder/fallback.
  const activeText = isLlm && moveComment ? moveComment : (activeExp?.text ?? "")
  const activeTone = activeExp?.tone ?? "neutral"

  return (
    <div className="flex flex-col max-h-40 md:h-full md:max-h-none">
      <div className="flex items-center justify-between px-3 py-2">
        <span className="font-mono text-[9px] md:text-[10px] uppercase tracking-[0.15em] text-gray-400">
          History
        </span>
        <div className="flex items-center gap-0.5 md:gap-1">
          <button
            onClick={goToStart}
            className="px-1 md:px-1.5 py-0.5 font-mono text-[11px] md:text-[10px] text-gray-400 transition-colors hover:text-black"
          >
            |&#x25C1;
          </button>
          <button
            onClick={goBack}
            className="px-1 md:px-1.5 py-0.5 font-mono text-[11px] md:text-[10px] text-gray-400 transition-colors hover:text-black"
          >
            &#x25C1;
          </button>
          <button
            onClick={togglePlay}
            disabled={atEnd}
            className={`px-1 md:px-1.5 py-0.5 font-mono text-[11px] md:text-[10px] transition-colors disabled:opacity-30 ${
              isPlaying ? "text-black" : "text-gray-400 hover:text-black"
            }`}
          >
            {isPlaying ? "■" : "▶"}
          </button>
          <button
            onClick={goForward}
            className="px-1 md:px-1.5 py-0.5 font-mono text-[11px] md:text-[10px] text-gray-400 transition-colors hover:text-black"
          >
            &#x25B7;
          </button>
          <button
            onClick={goToEnd}
            className="px-1 md:px-1.5 py-0.5 font-mono text-[11px] md:text-[10px] text-gray-400 transition-colors hover:text-black"
          >
            &#x25B7;|
          </button>
        </div>
      </div>

      <OpeningChip />

      {isPlaying && (
        <div className="flex items-center gap-1.5 px-3 pb-1.5">
          <button
            onClick={() => setPlaySpeed(1500)}
            className={`font-mono text-[8px] uppercase tracking-[0.1em] px-1 py-0.5 transition-colors ${
              playSpeed === 1500 ? "bg-black text-white" : "text-gray-400 hover:text-black hover:bg-gray-100"
            }`}
          >
            Slow
          </button>
          <button
            onClick={() => setPlaySpeed(500)}
            className={`font-mono text-[8px] uppercase tracking-[0.1em] px-1 py-0.5 transition-colors ${
              playSpeed === 500 ? "bg-black text-white" : "text-gray-400 hover:text-black hover:bg-gray-100"
            }`}
          >
            Med
          </button>
          <button
            onClick={() => setPlaySpeed(100)}
            className={`font-mono text-[8px] uppercase tracking-[0.1em] px-1 py-0.5 transition-colors ${
              playSpeed === 100 ? "bg-black text-white" : "text-gray-400 hover:text-black hover:bg-gray-100"
            }`}
          >
            Fast
          </button>
        </div>
      )}

      <div ref={listRef} className="flex-1 overflow-y-auto px-3 py-1">
        {pairs.length === 0 && (
          <p className="py-2 md:py-4 text-center font-mono text-[10px] text-gray-300">
            No moves yet
          </p>
        )}

        {pairs.map((pair, i) => {
          const moveNum = i + 1
          const whiteIdx = i * 2
          const blackIdx = whiteIdx + 1

          const whiteBookmarked = bookmarks.includes(whiteIdx)
          const blackBookmarked = pair.black && bookmarks.includes(blackIdx)

          const whiteComment = comments[whiteIdx]
          const blackComment = pair.black ? comments[blackIdx] : undefined

          return (
            <div key={moveNum}>
              <div className="flex items-center font-mono text-[11px] md:text-xs leading-relaxed">
                <span className="w-5 md:w-6 text-right text-gray-400 tabular-nums">
                  {moveNum}.
                </span>

                <button
                  onClick={() => toggleBookmark(whiteIdx)}
                  onContextMenu={(e) => {
                    e.preventDefault()
                    handleStartComment(whiteIdx)
                  }}
                  className={`ml-0.5 w-3 md:w-3.5 text-center text-[9px] md:text-[10px] transition-colors ${
                    whiteBookmarked
                      ? "text-black"
                      : "text-gray-300 hover:text-black"
                  }`}
                >
                  {whiteBookmarked ? "\u2605" : "\u2606"}
                </button>

                <button
                  ref={historyIndex === whiteIdx + 1 ? activeRef : undefined}
                  onClick={() => goToMove(whiteIdx + 1)}
                  title={explanations[whiteIdx]?.text}
                  onContextMenu={(e) => {
                    e.preventDefault()
                    handleStartComment(whiteIdx)
                  }}
                  className={`ml-0.5 px-1.5 md:px-1 py-0.5 tabular-nums transition-colors hover:bg-gray-100 ${
                    historyIndex === whiteIdx + 1
                      ? "bg-black text-white"
                      : "text-black"
                  }`}
                >
                  {pair.white!.san}
                </button>

                {marks[whiteIdx] && (
                  <span
                    className="ml-0.5 font-mono text-[11px] font-bold leading-none"
                    style={{ color: nagColor(marks[whiteIdx]) }}
                  >
                    {marks[whiteIdx]}
                  </span>
                )}

                {pair.black && (
                  <>
                    <button
                      onClick={() => toggleBookmark(blackIdx)}
                      onContextMenu={(e) => {
                        e.preventDefault()
                        handleStartComment(blackIdx)
                      }}
                      className={`ml-0.5 w-3 md:w-3.5 text-center text-[9px] md:text-[10px] transition-colors ${
                        blackBookmarked
                          ? "text-black"
                          : "text-gray-300 hover:text-black"
                      }`}
                    >
                      {blackBookmarked ? "\u2605" : "\u2606"}
                    </button>

                    <button
                      ref={historyIndex === blackIdx + 1 ? activeRef : undefined}
                      onClick={() => goToMove(blackIdx + 1)}
                      title={explanations[blackIdx]?.text}
                      onContextMenu={(e) => {
                        e.preventDefault()
                        handleStartComment(blackIdx)
                      }}
                      className={`ml-0.5 px-1.5 md:px-1 py-0.5 tabular-nums transition-colors hover:bg-gray-100 ${
                        historyIndex === blackIdx + 1
                          ? "bg-black text-white"
                          : "text-black"
                      }`}
                    >
                      {pair.black.san}
                    </button>

                    {marks[blackIdx] && (
                      <span
                        className="ml-0.5 font-mono text-[11px] font-bold leading-none"
                        style={{ color: nagColor(marks[blackIdx]) }}
                      >
                        {marks[blackIdx]}
                      </span>
                    )}
                  </>
                )}

                {whiteComment && (
                  <span className="ml-1 text-[9px] text-gray-400 truncate max-w-[80px]">
                    {whiteComment}
                  </span>
                )}
              </div>

              {(activePly === whiteIdx || activePly === blackIdx) &&
                (activeText || (isLlm && moveStreaming)) && (
                  <div className="pl-7 md:pl-8 pr-3 pb-1">
                    <span
                      className="block font-mono text-[9px] leading-snug"
                      style={{ color: toneColor(activeTone) }}
                    >
                      {activeText}
                      {isLlm && moveStreaming && <span className="text-gray-300"> ▍</span>}
                    </span>
                  </div>
                )}

              {editingComment === whiteIdx && (
                <div className="flex items-center gap-1 pl-7 md:pl-8 pr-3 py-1">
                  <input
                    autoFocus
                    value={commentValue}
                    onChange={(e) => setCommentValue(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault()
                        handleSaveComment(whiteIdx)
                      }
                      if (e.key === "Escape") {
                        setEditingComment(null)
                        setCommentValue("")
                      }
                    }}
                    placeholder="Comment..."
                    className="flex-1 bg-transparent font-mono text-[10px] outline-none placeholder:text-gray-300 text-black"
                  />
                  <button
                    onClick={() => handleSaveComment(whiteIdx)}
                    className="font-mono text-[9px] uppercase text-gray-400 hover:text-black"
                  >
                    Save
                  </button>
                </div>
              )}

              {pair.black && editingComment === blackIdx && (
                <div className="flex items-center gap-1 pl-7 md:pl-8 pr-3 py-1">
                  <input
                    autoFocus
                    value={commentValue}
                    onChange={(e) => setCommentValue(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault()
                        handleSaveComment(blackIdx)
                      }
                      if (e.key === "Escape") {
                        setEditingComment(null)
                        setCommentValue("")
                      }
                    }}
                    placeholder="Comment..."
                    className="flex-1 bg-transparent font-mono text-[10px] outline-none placeholder:text-gray-300 text-black"
                  />
                  <button
                    onClick={() => handleSaveComment(blackIdx)}
                    className="font-mono text-[9px] uppercase text-gray-400 hover:text-black"
                  >
                    Save
                  </button>
                </div>
              )}

              {blackComment && editingComment !== blackIdx && (
                <div className="pl-7 md:pl-8 pr-3">
                  <span className="text-[9px] text-gray-400 truncate block leading-snug">
                    {blackComment}
                  </span>
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
