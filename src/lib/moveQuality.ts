/**
 * Move-quality annotation (NAG-style: !!, !, ?!, ?, ??) derived purely from
 * cached engine evaluations — no extra searches. Each position is evaluated by
 * the analyzer as you browse/autoplay; when both sides of a move are cached we
 * compare them to judge the move.
 */

export type Nag = "!!" | "!" | "?!" | "?" | "??"

export interface PlyEval {
  /** Centipawn eval from White's perspective (mate mapped to ±MATE_BASE). */
  evalWhite: number
  /** Engine's best move (UCI/LAN) at this position, if known. */
  bestUci: string | null
  /** Centipawn gap between the best and 2nd-best move (≥0), if known. */
  gap: number | null
  depth: number
}

export const MATE_BASE = 100000
const MIN_DEPTH = 8

/** Map a side-to-move score/mate pair to a White-perspective centipawn value. */
export function toWhiteEval(
  sideToMove: "w" | "b",
  score: number,
  mate: number | null,
): number {
  if (mate !== null) {
    const whiteMate = sideToMove === "w" ? mate : -mate
    const mag = MATE_BASE - Math.min(MATE_BASE - 1, Math.abs(whiteMate))
    return whiteMate >= 0 ? mag : -mag
  }
  return sideToMove === "w" ? score : -score
}

/**
 * Classify the move that transitions `before` → `after`. Returns null when there
 * isn't enough (or deep enough) data to judge.
 */
export function classifyMove(
  moverIsWhite: boolean,
  before: PlyEval,
  after: PlyEval,
  playedUci: string,
): Nag | null {
  if (before.depth < MIN_DEPTH || after.depth < MIN_DEPTH) return null

  // Centipawn loss for the mover (≥0 means they gave something up).
  const cpl = Math.max(
    0,
    moverIsWhite ? before.evalWhite - after.evalWhite : after.evalWhite - before.evalWhite,
  )

  if (cpl >= 250) return "??"
  if (cpl >= 120) return "?"
  if (cpl >= 50) return "?!"

  // Good move: did they play the engine's top choice when it clearly mattered?
  const playedBest = before.bestUci != null && before.bestUci === playedUci
  if (playedBest && before.gap != null && cpl <= 20) {
    if (before.gap >= 250) return "!!"
    if (before.gap >= 120) return "!"
  }
  return null
}

/** Display colour for a NAG, coherent with the analyzer heatmap. */
export function nagColor(nag: Nag): string {
  switch (nag) {
    case "!!":
      return "#15803d" // green-700
    case "!":
      return "#16a34a" // green-600
    case "?!":
      return "#a3a3a3" // neutral-400
    case "?":
      return "#ea580c" // orange-600
    case "??":
      return "#dc2626" // red-600
  }
}
