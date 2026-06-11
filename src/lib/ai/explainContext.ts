/**
 * Context assembler: turns the facts the app already computes (engine eval,
 * move-quality NAG, motifs, opening, best move) into a compact, runtime-agnostic
 * payload. This is the single bridge feeding BOTH explainers — the Tier 0 template
 * engine and the Tier 1 LLM. The LLM never re-derives chess; it only verbalizes
 * the context built here.
 */

import type { Move } from "chess.js"
import { classifyMove, type PlyEval } from "../moveQuality"
import { type Motif } from "../motifs"
import { uciToSan } from "../uci"
import type { ExplainInput } from "../explain"
import type { GameReport, Improvement } from "../gameReport"

export type GamePhase = "opening" | "middlegame" | "endgame"

/** Everything an explainer needs about a single move (superset of ExplainInput). */
export interface MoveContext extends ExplainInput {
  ply: number
  san: string
  phase: GamePhase
  openingName: string | null
  cpLoss: number
}

/** Everything an explainer needs to narrate a whole game. */
export interface GameContext {
  report: GameReport
  openingName: string | null
  keyMoments: Improvement[]
}

export function phaseOf(ply: number, totalPlies: number): GamePhase {
  const frac = totalPlies > 0 ? ply / totalPlies : 0
  return frac < 1 / 3 ? "opening" : frac < 2 / 3 ? "middlegame" : "endgame"
}

export interface MoveContextArgs {
  mv: Move
  before?: PlyEval
  after?: PlyEval
  /** Motifs for this move (precomputed by the caller so they aren't recomputed per eval update). */
  motifs: Motif[]
  ply: number
  totalPlies: number
  lastBookPly: number
  openingName: string | null
}

export function buildMoveContext(args: MoveContextArgs): MoveContext {
  const { mv, before, after, motifs, ply, totalPlies, lastBookPly, openingName } = args
  const moverIsWhite = mv.color === "w"
  const nag = before && after ? classifyMove(moverIsWhite, before, after, mv.lan) : null
  const bestSan = before?.bestUci ? uciToSan(mv.before, before.bestUci) : null
  const cpLoss =
    before && after
      ? Math.max(0, moverIsWhite ? before.evalWhite - after.evalWhite : after.evalWhite - before.evalWhite)
      : 0
  return {
    moverIsWhite,
    before,
    after,
    nag,
    motifs,
    bestSan,
    isBookMove: ply < lastBookPly,
    ply,
    san: mv.san,
    phase: phaseOf(ply, totalPlies),
    openingName,
    cpLoss,
  }
}

export function buildGameContext(report: GameReport, openingName: string | null): GameContext {
  return { report, openingName, keyMoments: report.improvements }
}
