import type { Candidate } from "../hooks/useEngine"

export interface HeatArrow {
  startSquare: string
  endSquare: string
  color: string
}

export interface HeatmapResult {
  squareStyles: Record<string, { backgroundColor: string }>
  arrows: HeatArrow[]
}

// Muted accents — coherent with the monochrome shell, only used by the analyzer.
const GOOD: [number, number, number] = [22, 163, 74] // green-600
const BAD: [number, number, number] = [220, 38, 38] // red-600

// Centipawn loss (relative to the best move) at which a candidate reads as fully "bad".
const LOSS_FULL = 150

function scoreOf(c: Candidate): number {
  if (c.mate !== null) return c.mate > 0 ? 100000 : -100000
  return c.score
}

function lerp(a: [number, number, number], b: [number, number, number], t: number): [number, number, number] {
  return [
    Math.round(a[0] + (b[0] - a[0]) * t),
    Math.round(a[1] + (b[1] - a[1]) * t),
    Math.round(a[2] + (b[2] - a[2]) * t),
  ]
}

/**
 * Coherent heatmap: each candidate is coloured by its centipawn loss relative
 * to the best move (not the raw eval), so the picture means the same thing in
 * any position. Destination squares get a fixed alpha that fades by rank, and
 * the top 3 moves are drawn as arrows. Best move → green, worse → red.
 */
export function computeHeatmap(candidates: Candidate[]): HeatmapResult {
  const squareStyles: Record<string, { backgroundColor: string }> = {}
  const arrows: HeatArrow[] = []

  if (candidates.length === 0) return { squareStyles, arrows }

  const sorted = [...candidates].sort((a, b) => a.multipv - b.multipv)
  const best = scoreOf(sorted[0])

  sorted.forEach((c, i) => {
    const from = c.uci.slice(0, 2)
    const to = c.uci.slice(2, 4)
    if (to.length < 2) return

    const loss = Math.max(0, best - scoreOf(c))
    const t = Math.min(1, loss / LOSS_FULL)
    const [r, g, b] = lerp(GOOD, BAD, t)

    // Best move strongest, each rank fainter. Best move wins a shared square.
    if (!squareStyles[to]) {
      const alpha = Math.max(0.08, 0.3 - i * 0.05)
      squareStyles[to] = { backgroundColor: `rgba(${r}, ${g}, ${b}, ${alpha})` }
    }

    if (i < 3 && from.length === 2) {
      const opacity = Math.max(0.25, 0.7 - i * 0.2)
      arrows.push({ startSquare: from, endSquare: to, color: `rgba(${r}, ${g}, ${b}, ${opacity})` })
    }
  })

  return { squareStyles, arrows }
}

/** Shared colour for a candidate chip/dot, matching the board heatmap scale. */
export function candidateColor(candidates: Candidate[], c: Candidate): string {
  if (candidates.length === 0) return "rgb(163, 163, 163)"
  const best = scoreOf(candidates[0])
  const loss = Math.max(0, best - scoreOf(c))
  const t = Math.min(1, loss / LOSS_FULL)
  const [r, g, b] = lerp(GOOD, BAD, t)
  return `rgb(${r}, ${g}, ${b})`
}
