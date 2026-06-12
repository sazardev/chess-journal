import { useEffect, useRef } from "react"
import type { Square } from "chess.js"
import { useGameStore } from "../stores/useGameStore"
import { useAnalysisStore, posKey } from "../stores/useAnalysisStore"
import { useConfigStore } from "../stores/useConfigStore"
import { useAssistiveStore } from "../stores/useAssistiveStore"
import { useAiStore } from "../stores/useAiStore"
import { useOpeningStore } from "../stores/useOpeningStore"
import { pickAssistiveMove } from "./useEngine"
import type { useEngine } from "./useEngine"
import { detectMotifs } from "../lib/motifs"
import { buildMoveContext } from "../lib/ai/explainContext"
import { explainMove } from "../lib/explain"

export function useAssistiveMode(
  engine: ReturnType<typeof useEngine>,
  onReport: () => void,
) {
  const assistiveMode = useConfigStore((s) => s.assistiveMode)
  const assistiveColor = useConfigStore((s) => s.assistiveColor)

  const fen = useGameStore((s) => s.fen)
  const fullHistory = useGameStore((s) => s.fullHistory)
  const historyIndex = useGameStore((s) => s.historyIndex)
  const makeMove = useGameStore((s) => s.makeMove)
  const setMark = useAnalysisStore((s) => s.setMark)
  const byFen = useAnalysisStore((s) => s.byFen)
  const openingCurrent = useOpeningStore((s) => s.current)

  const {
    eval_,
    candidates,
    enabled: engineOn,
    ready: engineReady,
    toggle: toggleEngine,
    visualMode,
    toggleVisual,
  } = engine

  const initializedRef = useRef(false)
  const prevLenRef = useRef(0)

  // Initialize assistive mode: turn on engine, marks, visual, and AI commentary.
  useEffect(() => {
    if (assistiveMode && !initializedRef.current) {
      initializedRef.current = true
      if (!engineOn) toggleEngine()
      setMark(true)
      if (!visualMode) toggleVisual()

      // Auto-enable AI commentary when not unsupported/already running.
      const ai = useAiStore.getState()
      if (ai.phase !== "unsupported" && ai.phase !== "ready" && ai.phase !== "preparing") {
        useConfigStore.getState().setAiCommentary(true)
        void ai.enable()
      }
    }
    if (!assistiveMode) {
      initializedRef.current = false
      useAssistiveStore.getState().reset()
    }
  }, [assistiveMode])

  // Engine turn: when it's the engine's side, pick and play a move.
  useEffect(() => {
    if (!assistiveMode || !engineOn || !engineReady) return
    if (historyIndex < fullHistory.length) return

    const sideToMove = fen.split(" ")[1] as "w" | "b"
    const humanColor = assistiveColor[0] as "w" | "b"
    const isEngineTurn = sideToMove !== humanColor

    const store = useAssistiveStore.getState()

    if (!isEngineTurn) {
      if (store.turn !== "player") {
        store.setTurn("player")
        store.setEngineThinking(false)
      }
      return
    }

    if (store.turn !== "engine") store.setTurn("engine")

    if (store.engineThinking) return
    if (eval_.depth < 6 || candidates.length === 0) return

    const elo = useConfigStore.getState().assistiveElo
    const move = pickAssistiveMove(candidates, elo)
    if (!move) {
      store.setEngineThinking(false)
      return
    }

    store.setEngineThinking(true)

    const delay = 150 + Math.random() * 250
    const timer = setTimeout(() => {
      const from = move.uci.slice(0, 2) as Square
      const to = move.uci.slice(2, 4) as Square
      const promotion = move.uci.length > 4 ? move.uci[4] : undefined
      const ok = makeMove(from, to, promotion)
      store.setEngineThinking(false)
      if (ok) store.setTurn("player")
    }, delay)

    return () => {
      clearTimeout(timer)
      useAssistiveStore.getState().setEngineThinking(false)
    }
  }, [
    assistiveMode,
    engineOn,
    engineReady,
    fen,
    eval_.depth,
    candidates.length,
    historyIndex,
    fullHistory.length,
  ])

  // Game-over detection: open the report when the last move is checkmate.
  useEffect(() => {
    if (!assistiveMode) return
    if (fullHistory.length <= prevLenRef.current) {
      prevLenRef.current = fullHistory.length
      return
    }
    prevLenRef.current = fullHistory.length

    const lastSan = fullHistory[fullHistory.length - 1]?.san ?? ""
    if (lastSan.includes("#")) {
      setTimeout(() => onReport(), 1200)
    }
  }, [fullHistory.length, assistiveMode])

  // Feedback: build a coach card for EVERY player move (not just the last) so the
  // live card, the board's gray hint, and the history breakdown all read from one
  // source. Recomputed as evals stream into `byFen`.
  useEffect(() => {
    if (!assistiveMode) return

    const humanColor = assistiveColor[0] as "w" | "b"
    const store = useAssistiveStore.getState()

    const lastBookPly = openingCurrent?.lastBookPly ?? 0
    const openingName = openingCurrent?.name ?? null

    let lastPlayerPly: number | null = null

    for (let plyIdx = 0; plyIdx < fullHistory.length; plyIdx++) {
      const mv = fullHistory[plyIdx]
      if (mv.color !== humanColor) continue
      lastPlayerPly = plyIdx

      const before = byFen[posKey(mv.before)]
      if (!before) continue // engine hasn't cached the pre-move position yet

      const after = byFen[posKey(mv.after)]
      const motifs = detectMotifs(mv, fullHistory[plyIdx - 1])

      const ctx = buildMoveContext({
        mv,
        before,
        after,
        motifs,
        ply: plyIdx,
        totalPlies: fullHistory.length,
        lastBookPly,
        openingName,
      })

      const exp = explainMove(ctx)
      if (!exp) continue

      store.setPlyFeedback(plyIdx, {
        ply: plyIdx,
        san: mv.san,
        tone: exp.tone,
        text: exp.text,
        cpLoss: ctx.cpLoss,
        // Opening theory isn't the player's call — don't pin a NAG on book moves,
        // matching how the game report excludes book plies from scoring.
        nag: ctx.isBookMove ? null : ctx.nag,
        bestUci: before.bestUci,
        bestSan: ctx.bestSan,
      })
    }

    store.setLastPlayerPly(lastPlayerPly)
  }, [assistiveMode, assistiveColor, fullHistory, byFen, openingCurrent])
}
