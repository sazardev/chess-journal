import { useEffect, useRef, useState, useCallback } from "react"
import { useGameStore } from "../stores/useGameStore"
import { useAnalysisStore } from "../stores/useAnalysisStore"
import { toWhiteEval, MATE_BASE } from "../lib/moveQuality"

export interface EvalResult {
  score: number
  mate: number | null
  depth: number
  bestLine: string[]
}

export interface Candidate {
  uci: string
  score: number
  mate: number | null
  multipv: number
}

export function useEngine() {
  const [enabled, setEnabled] = useState(false)
  const [loading, setLoading] = useState(false)
  const [ready, setReady] = useState(false)
  const [visualMode, setVisualMode] = useState(false)
  const [eval_, setEval] = useState<EvalResult>({ score: 0, mate: null, depth: 0, bestLine: [] })
  const [candidates, setCandidates] = useState<Candidate[]>([])

  const workerRef = useRef<Worker | null>(null)
  const searchingRef = useRef(false)
  const fenRef = useRef("")
  const enabledRef = useRef(enabled)
  enabledRef.current = enabled

  const currentFen = useGameStore((s) => s.fen)
  fenRef.current = currentFen

  useEffect(() => {
    if (!enabled) {
      if (workerRef.current) {
        workerRef.current.terminate()
        workerRef.current = null
      }
      setReady(false)
      setLoading(false)
      setVisualMode(false)
      setEval({ score: 0, mate: null, depth: 0, bestLine: [] })
      setCandidates([])
      searchingRef.current = false
      return
    }

    setLoading(true)

    const worker = new Worker("/stockfish-engine.js")
    workerRef.current = worker

    let candidatesDepth = 0
    const candidatesMap = new Map<number, Candidate>()

    worker.onmessage = (e: MessageEvent<string>) => {
      const line = e.data

      if (line === "uciok") {
        setReady(true)
        setLoading(false)
        worker.postMessage("setoption name MultiPV value 8")
        return
      }

      if (!line.startsWith("info")) return

      const depthMatch = line.match(/depth (\d+)/)
      const cpMatch = line.match(/score cp (-?\d+)/)
      const mateMatch = line.match(/score mate (-?\d+)/)
      const multipvMatch = line.match(/multipv (\d+)/)
      const pvMatch = line.match(/ pv (.+?)(?:\s+(?:nodes|time|seldepth|score|nps|upperbound|lowerbound|hashfull|tbhits|multipv|currmove|currmovenumber|string)\s|\s*$)/)

      const depth = depthMatch ? Number(depthMatch[1]) : 0

      setEval((prev) => {
        const isBest = !multipvMatch || Number(multipvMatch[1]) === 1
        return {
          score: cpMatch && isBest ? Number(cpMatch[1]) : prev.score,
          mate: mateMatch && isBest ? Number(mateMatch[1]) : cpMatch && isBest ? null : prev.mate,
          depth: depthMatch ? Number(depthMatch[1]) : prev.depth,
          bestLine: pvMatch && isBest ? pvMatch[1].trim().split(" ") : prev.bestLine,
        }
      })

      const mpv = multipvMatch ? Number(multipvMatch[1]) : 0

      if (mpv > 0 && pvMatch) {
        const pvMoves = pvMatch[1].trim().split(" ")
        const firstMove = pvMoves[0]

        if (depth > candidatesDepth) {
          candidatesDepth = depth
          candidatesMap.clear()
        }

        if (depth === candidatesDepth && firstMove) {
          candidatesMap.set(mpv, {
            uci: firstMove,
            score: cpMatch ? Number(cpMatch[1]) : 0,
            mate: mateMatch ? Number(mateMatch[1]) : null,
            multipv: mpv,
          })
          setCandidates(
            Array.from(candidatesMap.values()).sort((a, b) => a.multipv - b.multipv),
          )
        }
      }
    }

    worker.onerror = () => {
      setEnabled(false)
    }

    worker.postMessage("uci")
    worker.postMessage("setoption name Threads value 1")
    worker.postMessage("setoption name Hash value 16")

    return () => {
      worker.terminate()
      workerRef.current = null
    }
  }, [enabled])

  useEffect(() => {
    if (!enabled || !ready || !workerRef.current) return

    const w = workerRef.current

    if (searchingRef.current) {
      w.postMessage("stop")
      searchingRef.current = false
    }

    const timer = setTimeout(() => {
      if (!enabledRef.current) return
      w.postMessage("position fen " + fenRef.current)
      w.postMessage("go depth 16")
      searchingRef.current = true
    }, 80)

    return () => {
      clearTimeout(timer)
    }
  }, [currentFen, enabled, ready])

  // Cache each position's eval (debounced, once the search settles) so the
  // Mark Analyzer can judge moves without any extra searches.
  useEffect(() => {
    if (!enabled || !ready || eval_.depth < 8) return
    const fen = currentFen
    const id = setTimeout(() => {
      const side = fen.split(" ")[1] === "b" ? "b" : "w"
      const evalWhite = toWhiteEval(side, eval_.score, eval_.mate)

      let gap: number | null = null
      if (candidates.length >= 2) {
        const sv = (c: Candidate) =>
          c.mate !== null ? (c.mate > 0 ? MATE_BASE : -MATE_BASE) : c.score
        gap = Math.max(0, sv(candidates[0]) - sv(candidates[1]))
      }
      const bestUci = candidates[0]?.uci ?? eval_.bestLine[0] ?? null

      useAnalysisStore.getState().record(fen, { evalWhite, bestUci, gap, depth: eval_.depth })
    }, 350)
    return () => clearTimeout(id)
  }, [enabled, ready, currentFen, eval_, candidates])

  const toggle = useCallback(() => {
    setEnabled((e) => !e)
  }, [])

  const toggleVisual = useCallback(() => {
    setVisualMode((v) => !v)
  }, [])

  return { enabled, loading, ready, eval_: eval_, candidates, visualMode, toggle, toggleVisual }
}
