/**
 * Per-move plain-language explanation (Tier 0 — no LLM). Deterministic templates
 * fed by facts that are already computed elsewhere: the engine eval (`PlyEval`),
 * the move-quality NAG, detected motifs, the best move in SAN, and whether the
 * move was still book. The engine decides *if* a move was good; this only phrases
 * it. Output is English, to match the app UI.
 */

import { type PlyEval, type Nag, MATE_BASE } from "./moveQuality"
import { type Motif, pieceName } from "./motifs"

export interface ExplainInput {
  moverIsWhite: boolean
  before?: PlyEval
  after?: PlyEval
  nag: Nag | null
  motifs: Motif[]
  /** Engine's best move at this position, in SAN (null if unknown). */
  bestSan: string | null
  /** True while the move is still part of a known opening line. */
  isBookMove: boolean
}

export type ExplainTone = "blunder" | "mistake" | "inaccuracy" | "good" | "neutral" | "book"

export interface MoveExplanation {
  text: string
  tone: ExplainTone
  /** Mover-perspective centipawn loss (≥0); 0 when an eval is missing. */
  cpLoss: number
}

/** Format a White-perspective eval for prose: "+1.2", "-3.1", "M3", "-M2". */
export function formatEval(evalWhite: number): string {
  if (Math.abs(evalWhite) >= MATE_BASE - 1000) {
    const n = MATE_BASE - Math.abs(evalWhite)
    return evalWhite > 0 ? `M${n}` : `-M${n}`
  }
  const pawns = evalWhite / 100
  return pawns >= 0 ? `+${pawns.toFixed(1)}` : pawns.toFixed(1)
}

function toneFor(nag: Nag | null): ExplainTone {
  switch (nag) {
    case "??":
      return "blunder"
    case "?":
      return "mistake"
    case "?!":
      return "inaccuracy"
    case "!!":
    case "!":
      return "good"
    default:
      return "neutral"
  }
}

/**
 * Build a one-line explanation for a move. Returns null only when there's no eval
 * data at all to work from (both sides of the move uncached).
 */
export function explainMove(input: ExplainInput): MoveExplanation | null {
  const { before, after, nag, motifs, bestSan, isBookMove, moverIsWhite } = input
  if (!before && !after) return null

  if (isBookMove) {
    return { text: "Book move (theory).", tone: "book", cpLoss: 0 }
  }

  const cpLoss =
    before && after
      ? Math.max(0, moverIsWhite ? before.evalWhite - after.evalWhite : after.evalWhite - before.evalWhite)
      : 0
  const tone = toneFor(nag)
  const tag = after ? ` (${formatEval(after.evalWhite)})` : ""

  const find = (kind: Motif["kind"]) => motifs.find((m) => m.kind === kind)
  const isMate = motifs.some((m) => m.kind === "checkmate")

  let text: string
  if (tone === "blunder" || tone === "mistake" || tone === "inaccuracy") {
    const hang = find("hangsPiece")
    const lead = hang?.piece
      ? `Hangs the ${pieceName(hang.piece)} on ${hang.square}`
      : tone === "blunder"
        ? "A blunder"
        : tone === "mistake"
          ? "A mistake"
          : "An inaccuracy"
    text = `${lead}${tag}.`
    if (bestSan) text += ` Best was ${bestSan}.`
  } else if (tone === "good") {
    if (isMate) {
      text = "Checkmate!"
    } else {
      const fork = find("fork")
      let lead = nag === "!!" ? "Brilliant move" : "Strong move"
      if (fork?.piece) lead += ` — forks the ${pieceName(fork.piece)}`
      else if (find("check")) lead += " with check"
      text = `${lead}${tag}.`
    }
  } else {
    // neutral — surface a notable motif if present, else a low-key note
    if (isMate) {
      text = "Checkmate!"
    } else {
      const fork = find("fork")
      const promo = find("promotion")
      const cap = find("capture") ?? find("recapture")
      let lead: string
      if (fork?.piece) lead = `Forks the ${pieceName(fork.piece)}`
      else if (promo?.piece) lead = `Promotes to a ${pieceName(promo.piece)}`
      else if (cap?.piece) lead = `Captures the ${pieceName(cap.piece)}`
      else if (find("check")) lead = "Check"
      else lead = "Solid move"
      text = `${lead}${tag}.`
    }
  }

  return { text, tone, cpLoss }
}
