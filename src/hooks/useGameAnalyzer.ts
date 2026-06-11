import { useCallback, useRef, useState } from "react"
import { useGameStore } from "../stores/useGameStore"
import { useAnalysisStore, posKey } from "../stores/useAnalysisStore"
import { useAnalysisCacheStore, analysisCacheKey } from "../stores/useAnalysisCacheStore"
import { useConfigStore } from "../stores/useConfigStore"
import { toWhiteEval, MATE_BASE, type PlyEval } from "../lib/moveQuality"

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

    const cfg = useConfigStore.getState().engineConfig
    const scanDepth = cfg.scanDepth

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
    worker.postMessage("setoption name Threads value " + cfg.threads)
    worker.postMessage("setoption name Hash value " + cfg.hash)

    for (let i = 0; i < positions.length; i++) {
      if (cancelRef.current) break
      const fen = positions[i]
      const existing = useAnalysisStore.getState().byFen[posKey(fen)]
      if (!existing || existing.depth < scanDepth) {
        const result = await analyzePosition(worker, fen, scanDepth)
        if (result) useAnalysisStore.getState().record(fen, result)
      }
      setDone(i + 1)
    }

    if (workerRef.current) {
      workerRef.current.terminate()
      workerRef.current = null
    }
    setAnalyzing(false)
    if (!cancelRef.current) {
      useAnalysisStore.getState().setMark(true)
      // Persist this analysis under (preset + start + moves) so reopening the
      // game — or re-running Analyze with the same preset — is instant.
      const g = useGameStore.getState()
      const preset = useConfigStore.getState().engineConfig.preset
      const key = analysisCacheKey(preset, g.startFen, g.fullHistory.map((m) => m.lan))
      useAnalysisCacheStore.getState().put(key, useAnalysisStore.getState().byFen)
    }
  }, [cancel])

  return { analyzing, done, total, run, cancel }
}
