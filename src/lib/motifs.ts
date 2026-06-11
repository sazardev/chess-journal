/**
 * Tactical-motif detection for move explanations (Tier 0 — no engine, no LLM).
 *
 * Built purely on chess.js primitives (`attackers`, `get`, `board`) applied to a
 * move's resulting position. These are heuristics for *commentary*, not a static
 * exchange evaluator: e.g. `attackers()` counts pinned pieces, and fork detection
 * is geometric (it doesn't prove the win is safe). Good enough to caption a move;
 * the engine eval (PlyEval) remains the source of truth for whether it was good.
 */

import { Chess, type Color, type PieceSymbol, type Square, type Move } from "chess.js"

export type MotifKind =
  | "capture"
  | "recapture"
  | "hangsPiece"
  | "fork"
  | "check"
  | "checkmate"
  | "promotion"

export interface Motif {
  kind: MotifKind
  /** Square the motif centres on (the captured/hung/forking square). */
  square?: Square
  /** Piece involved (captured piece, hung piece, or best fork target). */
  piece?: PieceSymbol
  /** For forks: the enemy squares attacked. */
  targets?: Square[]
  /** Approximate centipawn value at stake — used for ranking and prose. */
  material?: number
}

/** Centipawn piece values for motif ranking & "hangs the X" prose. */
export const PIECE_VALUE: Record<PieceSymbol, number> = {
  p: 100,
  n: 300,
  b: 330,
  r: 500,
  q: 900,
  k: 0,
}

/** Rank weight for sorting motifs when several apply to one move. */
function rank(m: Motif): number {
  if (m.kind === "checkmate") return 1_000_000
  return m.material ?? 0
}

const other = (c: Color): Color => (c === "w" ? "b" : "w")

/**
 * Is the piece on `square` (owned by `owner`) hanging in this position?
 * Heuristic (not full static exchange): it's attacked and either undefended, or
 * the cheapest non-king attacker is worth less than the piece — so the opponent
 * comes out ahead on the trade.
 */
export function isHanging(after: Chess, square: Square, owner: Color): boolean {
  const pc = after.get(square)
  if (!pc || pc.color !== owner) return false
  const pieceValue = PIECE_VALUE[pc.type]
  if (pieceValue === 0) return false // king "hanging" is just check — handled elsewhere

  const attackers = after.attackers(square, other(owner))
  if (attackers.length === 0) return false

  const defenders = after.attackers(square, owner)
  if (defenders.length === 0) return true

  // A king can't capture a defended piece, so ignore king attackers here.
  const attackerValues: number[] = []
  for (const sq of attackers) {
    const a = after.get(sq)
    if (a && a.type !== "k") attackerValues.push(PIECE_VALUE[a.type])
  }
  if (attackerValues.length === 0) return false
  return Math.min(...attackerValues) < pieceValue
}

/** Enemy-occupied squares attacked by the (owner's) piece standing on `from`. */
export function attackedEnemies(after: Chess, from: Square, owner: Color): Square[] {
  const enemy = other(owner)
  const out: Square[] = []
  for (const row of after.board()) {
    for (const cell of row) {
      if (cell && cell.color === enemy && after.attackers(cell.square, owner).includes(from)) {
        out.push(cell.square)
      }
    }
  }
  return out
}

/**
 * Detect motifs for the position *after* `move` was played. `prevMove` (the
 * opponent's previous move) is optional and only used to tell a recapture from a
 * fresh capture. Returns motifs sorted by what's most at stake (desc).
 */
export function detectMotifs(move: Move, prevMove?: Move): Motif[] {
  const motifs: Motif[] = []
  const after = new Chess(move.after)
  const owner = move.color
  const mate = after.isCheckmate()

  if (move.promotion) {
    motifs.push({
      kind: "promotion",
      square: move.to,
      piece: move.promotion,
      material: PIECE_VALUE[move.promotion] - PIECE_VALUE.p,
    })
  }

  if (move.captured) {
    const isRecapture = !!prevMove && prevMove.captured != null && prevMove.to === move.to
    motifs.push({
      kind: isRecapture ? "recapture" : "capture",
      square: move.to,
      piece: move.captured,
      material: PIECE_VALUE[move.captured],
    })
  }

  if (mate) {
    motifs.push({ kind: "checkmate", square: move.to })
  } else if (after.isCheck()) {
    motifs.push({ kind: "check", square: move.to, material: 50 })
  }

  if (!mate) {
    // Did the move leave the just-moved piece hanging?
    if (isHanging(after, move.to, owner)) {
      const pc = after.get(move.to)
      motifs.push({
        kind: "hangsPiece",
        square: move.to,
        piece: pc?.type,
        material: pc ? PIECE_VALUE[pc.type] : 0,
      })
    }

    // Does the moved piece now attack two or more valuable enemy pieces?
    const targets = attackedEnemies(after, move.to, owner).filter((sq) => {
      const t = after.get(sq)
      return !!t && (t.type === "k" || PIECE_VALUE[t.type] >= PIECE_VALUE.n)
    })
    if (targets.length >= 2) {
      let bestPiece: PieceSymbol | undefined
      let bestVal = 0
      for (const sq of targets) {
        const t = after.get(sq)!
        if (t.type !== "k" && PIECE_VALUE[t.type] > bestVal) {
          bestVal = PIECE_VALUE[t.type]
          bestPiece = t.type
        }
      }
      motifs.push({ kind: "fork", square: move.to, piece: bestPiece, targets, material: bestVal })
    }
  }

  return motifs.sort((a, b) => rank(b) - rank(a))
}

/** Full English name for a piece symbol (for prose). */
export function pieceName(p: PieceSymbol): string {
  switch (p) {
    case "p":
      return "pawn"
    case "n":
      return "knight"
    case "b":
      return "bishop"
    case "r":
      return "rook"
    case "q":
      return "queen"
    case "k":
      return "king"
  }
}
