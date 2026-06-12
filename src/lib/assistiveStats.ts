/**
 * Per-game performance summary for Assistive (coach) mode. Purely derived from
 * the per-move feedback the coach already computes — no engine searches, no
 * persistence of its own. Accuracy and the performance-rating estimate use the
 * documented curves below; treat the rating as a rough gauge, not an official ELO.
 */

import type { AssistiveFeedback } from "../stores/useAssistiveStore"
import type { Nag } from "./moveQuality"

export interface AssistiveCounts {
  "!!": number
  "!": number
  "?!": number
  "?": number
  "??": number
  /** Reasonable moves that earned no NAG (and aren't book). */
  ok: number
  /** Moves still in opening theory. */
  book: number
}

export interface AssistiveSummary {
  /** Number of player moves graded (book moves included). */
  moves: number
  /** Mean per-move accuracy, 0–100. */
  accuracy: number
  /** Mean mover-perspective centipawn loss across non-book moves. */
  avgCpLoss: number
  counts: AssistiveCounts
  /** Rough ELO-style estimate of the play shown this game. */
  perfRating: number
}

/**
 * Per-move accuracy from centipawn loss: a smooth exponential decay.
 *   cpLoss   0 → 100 · 20 → 92 · 50 → 82 · 120 → 62 · 250 → 37 · 500 → 13
 */
export function moveAccuracy(cpLoss: number): number {
  return 100 * Math.exp(-Math.max(0, cpLoss) / 250)
}

/**
 * Map mean accuracy to a rough performance rating. Linear gauge anchored so
 * 50% ≈ 800 and 100% ≈ 2700, clamped to a sane band.
 */
function ratingFromAccuracy(accuracy: number): number {
  const raw = (accuracy - 50) * 38 + 800
  return Math.round(Math.min(2900, Math.max(400, raw)))
}

const EMPTY_COUNTS = (): AssistiveCounts => ({
  "!!": 0, "!": 0, "?!": 0, "?": 0, "??": 0, ok: 0, book: 0,
})

export function summarize(
  feedbackByPly: Record<number, AssistiveFeedback>,
): AssistiveSummary {
  const items = Object.values(feedbackByPly)
  const counts = EMPTY_COUNTS()

  if (items.length === 0) {
    return { moves: 0, accuracy: 100, avgCpLoss: 0, counts, perfRating: 0 }
  }

  let accSum = 0
  let cpSum = 0
  let cpMoves = 0

  for (const fb of items) {
    if (fb.tone === "book") {
      counts.book++
      accSum += 100 // theory plays at full accuracy
      continue
    }
    accSum += moveAccuracy(fb.cpLoss)
    cpSum += fb.cpLoss
    cpMoves++
    if (fb.nag) counts[fb.nag as Nag]++
    else counts.ok++
  }

  const accuracy = accSum / items.length
  return {
    moves: items.length,
    accuracy,
    avgCpLoss: cpMoves > 0 ? cpSum / cpMoves : 0,
    counts,
    perfRating: ratingFromAccuracy(accuracy),
  }
}
