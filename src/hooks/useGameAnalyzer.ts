import { useCallback, useRef, useState } from "react"
import { useGameStore } from "../stores/useGameStore"
import { useAnalysisStore, posKey } from "../stores/useAnalysisStore"
import { toWhiteEval, MATE_BASE, type PlyEval } from "../lib/moveQuality"

// Depth for the one-shot whole-game scan. Lower than the live engine (16) so a
// full game finishes in a few seconds; still plenty for move-quality verdicts.
const SCAN_DEPTH = 14

interface MpvLine {
  score: number
  mate: number | null
  uci: string
}

function waitForUci(worker: Worker, timeoutMs = 4000): Promise<boolean> {
  return new Promise((resolve) => {
    const timer = setTimeout(() => {
      worker.removeEventListener("message", onMsg)
      resolve(false)
    }, timeoutMs)
    const onMsg = (e: MessageEvent<string>) => {
      if (e.data === "uciok") {
        clearTimeout(timer)
        worker.removeEventListener("message", onMsg)
        resolve(true)
      }
    }
    worker.addEventListener("message", onMsg)
    worker.postMessage("uci")
  })
}

function analyzePosition(worker: Worker, fen: string, depth: number): Promise<PlyEval | null> {
  return new Promise((resolve) => {
    const side = fen.split(" ")[1] === "b" ? "b" : "w"
    const lines = new Map<number, MpvLine>()
    let maxDepth = 0
    let settled = false

    const finish = () => {
      if (settled) return
      settled = true
      worker.removeEventListener("message", onMsg)
      const mpv1 = lines.get(1)
      if (!mpv1) {
        resolve(null)
        return
      }
      const evalWhite = toWhiteEval(side, mpv1.score, mpv1.mate)
      const mpv2 = lines.get(2)
      let gap: number | null = null
      if (mpv2) {
        const sv = (m: MpvLine) => (m.mate !== null ? (m.mate > 0 ? MATE_BASE : -MATE_BASE) : m.score)
        gap = Math.max(0, sv(mpv1) - sv(mpv2))
      }
      resolve({ evalWhite, bestUci: mpv1.uci, gap, depth: maxDepth })
    }

    const onMsg = (e: MessageEvent<string>) => {
      const line = e.data
      if (line.startsWith("bestmove")) {
        finish()
        return
      }
      if (!line.startsWith("info")) return
      const d = line.match(/depth (\d+)/)
      const mpvM = line.match(/multipv (\d+)/)
      const cp = line.match(/score cp (-?\d+)/)
      const mate = line.match(/score mate (-?\d+)/)
      const pv = line.match(/ pv (\S+)/)
      if (!d || !mpvM || !pv) return
      const depthN = Number(d[1])
      if (depthN > maxDepth) maxDepth = depthN
      lines.set(Number(mpvM[1]), {
        score: cp ? Number(cp[1]) : 0,
        mate: mate ? Number(mate[1]) : null,
        uci: pv[1],
      })
    }

    worker.addEventListener("message", onMsg)
    worker.postMessage("position fen " + fen)
    worker.postMessage("go depth " + depth)
  })
}

export function useGameAnalyzer() {
  const [analyzing, setAnalyzing] = useState(false)
  const [done, setDone] = useState(0)
  const [total, setTotal] = useState(0)
  const cancelRef = useRef(false)
  const workerRef = useRef<Worker | null>(null)

  const cancel = useCallback(() => {
    cancelRef.current = true
    workerRef.current?.terminate()
    workerRef.current = null
    setAnalyzing(false)
  }, [])

  const run = useCallback(async () => {
    if (workerRef.current) return
    const { fullHistory } = useGameStore.getState()
    if (fullHistory.length === 0) return

    // Unique positions: start + after every move.
    const seen = new Set<string>()
    const positions: string[] = []
    const push = (fen?: string) => {
      if (!fen) return
      const k = posKey(fen)
      if (seen.has(k)) return
      seen.add(k)
      positions.push(fen)
    }
    push((fullHistory[0] as unknown as { before?: string }).before)
    for (const m of fullHistory) push((m as unknown as { after?: string }).after)

    setTotal(positions.length)
    setDone(0)
    setAnalyzing(true)
    cancelRef.current = false

    const worker = new Worker("/stockfish-engine.js")
    workerRef.current = worker
    worker.onerror = () => cancel()

    const ready = await waitForUci(worker)
    if (!ready || cancelRef.current) {
      cancel()
      return
    }
    worker.postMessage("setoption name MultiPV value 2")
    worker.postMessage("setoption name Threads value 1")
    worker.postMessage("setoption name Hash value 16")

    for (let i = 0; i < positions.length; i++) {
      if (cancelRef.current) break
      const fen = positions[i]
      const existing = useAnalysisStore.getState().byFen[posKey(fen)]
      if (!existing || existing.depth < SCAN_DEPTH) {
        const result = await analyzePosition(worker, fen, SCAN_DEPTH)
        if (result) useAnalysisStore.getState().record(fen, result)
      }
      setDone(i + 1)
    }

    if (workerRef.current) {
      workerRef.current.terminate()
      workerRef.current = null
    }
    setAnalyzing(false)
    if (!cancelRef.current) useAnalysisStore.getState().setMark(true)
  }, [cancel])

  return { analyzing, done, total, run, cancel }
}
