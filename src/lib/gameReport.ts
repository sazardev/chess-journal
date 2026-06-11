/**
 * Aggregated game report (Tier 0 — no LLM): per-side accuracy, average centipawn
 * loss (ACPL), an approximate rating band, and ranked improvement points. Pure
 * and synchronous over the move list plus the engine's cached evals (`byFen`).
 *
 * Accuracy uses Lichess's published curves: a logistic centipawn→win% mapping and
 * an exponential win%-drop→accuracy% mapping. The rating estimate is a heuristic
 * ACPL→Elo band, presented as approximate — not a measured rating.
 */

import type { Move } from "chess.js"
import { classifyMove, type Nag, type PlyEval } from "./moveQuality"

export interface MovePoint {
  /** 0-based index into the move list. */
  ply: number
  san: string
  moverIsWhite: boolean
  /** Capped centipawn loss for the mover (≥0). */
  cpLoss: number
  /** Mover-perspective win% before and after the move. */
  winBefore: number
  winAfter: number
  /** Per-move accuracy 0..100. */
  accuracy: number
  nag: Nag | null
}

export interface SideReport {
  /** Number of (covered, non-book) moves scored for this side. */
  scored: number
  acpl: number
  accuracy: number
  estimatedElo: { band: string; low: number; high: number } | null
  blunders: number
  mistakes: number
  inaccuracies: number
}

export interface Improvement {
  ply: number
  kind: "blunder" | "evalSwing" | "missedBest"
  san: string
  cpLoss: number
  note: string
}

export interface GameReport {
  white: SideReport
  black: SideReport
  perMove: MovePoint[]
  improvements: Improvement[]
  /** Plies with evals for both sides of the move. */
  coveredPlies: number
  totalPlies: number
  weakestPhase: "opening" | "middlegame" | "endgame" | null
}

export interface ReportOptions {
  /** Opening-theory plies to exclude from scoring (from `lastBookPly`). */
  bookPlies?: number
  /** Cap on per-move centipawn loss (default 1000) so mate flips don't dominate. */
  capCp?: number
}

/** Below this many scored moves, a rating estimate isn't meaningful. */
const MIN_SCORED = 4
/** A move losing at least this much (centipawns) is worth surfacing. */
const IMPROVEMENT_CP = 100
const MAX_IMPROVEMENTS = 6

/** Lichess centipawn → win% (mover perspective). Saturates safely near ±mate. */
export function winPct(cp: number): number {
  return 50 + 50 * (2 / (1 + Math.exp(-0.00368208 * cp)) - 1)
}

/** Lichess per-move accuracy from the win% drop the move caused. Clamped 0..100. */
export function moveAccuracy(winBefore: number, winAfter: number): number {
  const acc = 103.1668 * Math.exp(-0.04354 * (winBefore - winAfter)) - 3.1669
  return Math.max(0, Math.min(100, acc))
}

// Heuristic ACPL → rating anchors (lower loss ⇒ higher rating), interpolated.
const ELO_ANCHORS: { acpl: number; elo: number }[] = [
  { acpl: 10, elo: 2500 },
  { acpl: 15, elo: 2300 },
  { acpl: 20, elo: 2100 },
  { acpl: 30, elo: 1900 },
  { acpl: 40, elo: 1600 },
  { acpl: 55, elo: 1300 },
  { acpl: 80, elo: 1000 },
  { acpl: 120, elo: 700 },
]

const round50 = (n: number): number => Math.round(n / 50) * 50

/** Approximate rating band from ACPL. Monotonic: lower ACPL ⇒ higher band. */
export function acplToEloBand(acpl: number): { band: string; low: number; high: number } {
  let elo: number
  const first = ELO_ANCHORS[0]
  const last = ELO_ANCHORS[ELO_ANCHORS.length - 1]
  if (acpl <= first.acpl) {
    elo = first.elo
  } else if (acpl >= last.acpl) {
    elo = last.elo
  } else {
    elo = last.elo
    for (let i = 0; i < ELO_ANCHORS.length - 1; i++) {
      const a = ELO_ANCHORS[i]
      const b = ELO_ANCHORS[i + 1]
      if (acpl >= a.acpl && acpl <= b.acpl) {
        const t = (acpl - a.acpl) / (b.acpl - a.acpl)
        elo = a.elo + t * (b.elo - a.elo)
        break
      }
    }
  }
  const center = round50(elo)
  return { band: `~${center}`, low: round50(center - 150), high: round50(center + 150) }
}

function posKey(fen: string): string {
  return fen.split(" ").slice(0, 4).join(" ")
}

const mean = (xs: number[]): number => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0)

interface SideAcc {
  cpLoss: number[]
  accuracy: number[]
  blunders: number
  mistakes: number
  inaccuracies: number
}

const emptySide = (): SideAcc => ({ cpLoss: [], accuracy: [], blunders: 0, mistakes: 0, inaccuracies: 0 })

function finalizeSide(s: SideAcc): SideReport {
  const acpl = Math.round(mean(s.cpLoss))
  return {
    scored: s.cpLoss.length,
    acpl,
    accuracy: Math.round(mean(s.accuracy) * 10) / 10,
    estimatedElo: s.cpLoss.length >= MIN_SCORED ? acplToEloBand(acpl) : null,
    blunders: s.blunders,
    mistakes: s.mistakes,
    inaccuracies: s.inaccuracies,
  }
}

/** Build the full report from the move list and the engine's cached evals. */
export function buildGameReport(
  history: Move[],
  byFen: Record<string, PlyEval>,
  opts: ReportOptions = {},
): GameReport {
  const bookPlies = opts.bookPlies ?? 0
  const capCp = opts.capCp ?? 1000

  const perMove: MovePoint[] = []
  const candidates: { point: MovePoint; missedBest: boolean }[] = []
  const sides = { w: emptySide(), b: emptySide() }
  let coveredPlies = 0

  for (let i = 0; i < history.length; i++) {
    const mv = history[i]
    const before = byFen[posKey(mv.before)]
    const after = byFen[posKey(mv.after)]
    if (!before || !after) continue
    coveredPlies++
    if (i < bookPlies) continue // opening theory — not the player's call

    const moverIsWhite = mv.color === "w"
    const rawLoss = moverIsWhite
      ? before.evalWhite - after.evalWhite
      : after.evalWhite - before.evalWhite
    const cpLoss = Math.min(capCp, Math.max(0, rawLoss))

    const evalBefore = moverIsWhite ? before.evalWhite : -before.evalWhite
    const evalAfter = moverIsWhite ? after.evalWhite : -after.evalWhite
    const winBefore = winPct(evalBefore)
    const winAfter = winPct(evalAfter)
    const accuracy = moveAccuracy(winBefore, winAfter)
    const nag = classifyMove(moverIsWhite, before, after, mv.lan)

    const point: MovePoint = { ply: i, san: mv.san, moverIsWhite, cpLoss, winBefore, winAfter, accuracy, nag }
    perMove.push(point)
    candidates.push({ point, missedBest: before.bestUci != null && before.bestUci !== mv.lan })

    const side = moverIsWhite ? sides.w : sides.b
    side.cpLoss.push(cpLoss)
    side.accuracy.push(accuracy)
    if (nag === "??") side.blunders++
    else if (nag === "?") side.mistakes++
    else if (nag === "?!") side.inaccuracies++
  }

  const improvements: Improvement[] = candidates
    .filter((c) => c.point.cpLoss >= IMPROVEMENT_CP)
    .sort((a, b) => b.point.cpLoss - a.point.cpLoss)
    .slice(0, MAX_IMPROVEMENTS)
    .map(({ point, missedBest }) => {
      const pawns = (point.cpLoss / 100).toFixed(1)
      let kind: Improvement["kind"]
      let note: string
      if (point.nag === "??") {
        kind = "blunder"
        note = `Blunder — lost ${pawns} pawns`
      } else if (missedBest) {
        kind = "missedBest"
        note = `A stronger move was available — lost ${pawns} pawns`
      } else {
        kind = "evalSwing"
        note = `Inaccurate — lost ${pawns} pawns`
      }
      return { ply: point.ply, kind, san: point.san, cpLoss: point.cpLoss, note }
    })

  return {
    white: finalizeSide(sides.w),
    black: finalizeSide(sides.b),
    perMove,
    improvements,
    coveredPlies,
    totalPlies: history.length,
    weakestPhase: pickWeakestPhase(perMove, history.length),
  }
}

/**
 * A short, deterministic English summary of the report (Tier 0). This is also the
 * baseline the Tier 1 LLM is asked to expand into richer prose.
 */
export function summarizeReport(report: GameReport, openingName?: string | null): string {
  if (report.coveredPlies === 0) return "Run the engine analysis to generate a summary."

  const sidePhrase = (label: string, s: SideReport): string => {
    if (!s.scored) return `${label} wasn't analyzed`
    const elo = s.estimatedElo ? ` (${s.estimatedElo.band})` : ""
    return `${label} played at ${s.accuracy.toFixed(0)}%${elo}`
  }

  const opening = openingName ? `In the ${openingName}, ` : ""
  const parts: string[] = [
    `${opening}${sidePhrase("White", report.white)} and ${sidePhrase("Black", report.black)}.`,
  ]

  const blunders = report.white.blunders + report.black.blunders
  if (blunders > 0) {
    parts.push(`${blunders} blunder${blunders > 1 ? "s" : ""} shaped the critical moments.`)
  } else if (report.improvements.length > 0) {
    parts.push("A few inaccuracies aside, it was solidly played.")
  } else {
    parts.push("A clean game with no major mistakes.")
  }

  if (report.weakestPhase) parts.push(`Weakest phase: the ${report.weakestPhase}.`)
  return parts.join(" ")
}

function pickWeakestPhase(
  perMove: MovePoint[],
  totalPlies: number,
): GameReport["weakestPhase"] {
  if (perMove.length === 0 || totalPlies === 0) return null
  const buckets: Record<"opening" | "middlegame" | "endgame", number[]> = {
    opening: [],
    middlegame: [],
    endgame: [],
  }
  for (const p of perMove) {
    const frac = p.ply / totalPlies
    const phase = frac < 1 / 3 ? "opening" : frac < 2 / 3 ? "middlegame" : "endgame"
    buckets[phase].push(p.cpLoss)
  }
  let worst: GameReport["weakestPhase"] = null
  let worstMean = -1
  for (const phase of ["opening", "middlegame", "endgame"] as const) {
    if (buckets[phase].length === 0) continue
    const m = mean(buckets[phase])
    if (m > worstMean) {
      worstMean = m
      worst = phase
    }
  }
  return worst
}
