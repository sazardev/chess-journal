import { useEffect, useRef, useState, useCallback } from "react"
import { useGameStore } from "../stores/useGameStore"

export interface EvalResult {
  score: number
  mate: number | null
  depth: number
  bestLine: string[]
}

export function useEngine() {
  const [enabled, setEnabled] = useState(false)
  const [loading, setLoading] = useState(false)
  const [ready, setReady] = useState(false)
  const [eval_, setEval] = useState<EvalResult>({ score: 0, mate: null, depth: 0, bestLine: [] })

  const workerRef = useRef<Worker | null>(null)
  const searchingRef = useRef(false)
  const pendingRef = useRef(false)
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
      setEval({ score: 0, mate: null, depth: 0, bestLine: [] })
      searchingRef.current = false
      pendingRef.current = false
      return
    }

    setLoading(true)

    const worker = new Worker("/stockfish-engine.js")
    workerRef.current = worker

    worker.onmessage = (e: MessageEvent<string>) => {
      const line = e.data

      if (line === "uciok") {
        setReady(true)
        setLoading(false)
        return
      }

      if (!line.startsWith("info")) return

      const depthMatch = line.match(/depth (\d+)/)
      const cpMatch = line.match(/score cp (-?\d+)/)
      const mateMatch = line.match(/score mate (-?\d+)/)
      const pvMatch = line.match(/ pv (.+?)(?:\s+(?:nodes|time|seldepth|score|nps|upperbound|lowerbound|hashfull|tbhits|multipv|currmove|currmovenumber|string)\s|\s*$)/)

      setEval((prev) => {
        const next: EvalResult = {
          score: cpMatch ? Number(cpMatch[1]) : prev.score,
          mate: mateMatch ? Number(mateMatch[1]) : cpMatch ? null : prev.mate,
          depth: depthMatch ? Number(depthMatch[1]) : prev.depth,
          bestLine: pvMatch ? pvMatch[1].trim().split(" ") : prev.bestLine,
        }
        return next
      })
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
      pendingRef.current = true
    }

    const timer = setTimeout(() => {
      if (!enabledRef.current) return
      w.postMessage("position fen " + fenRef.current)
      w.postMessage("go depth 18")
      searchingRef.current = true
      pendingRef.current = false
    }, 80)

    return () => {
      clearTimeout(timer)
    }
  }, [currentFen, enabled, ready])

  const toggle = useCallback(() => {
    setEnabled((e) => !e)
  }, [])

  return { enabled, loading, ready, eval_: eval_, toggle }
}
