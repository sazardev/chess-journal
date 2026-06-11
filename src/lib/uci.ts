import { Chess, type Square } from "chess.js"

function playUci(g: Chess, uci: string): string | null {
  const from = uci.slice(0, 2) as Square
  const to = uci.slice(2, 4) as Square
  const promotion = uci.length > 4 ? uci[4] : undefined
  try {
    const move = g.move({ from, to, promotion })
    return move ? move.san : null
  } catch {
    return null
  }
}

/** Convert a single UCI/LAN move to SAN in the given position (falls back to the UCI). */
export function uciToSan(fen: string, uci: string): string {
  return playUci(new Chess(fen), uci) ?? uci
}

/** Convert a sequence of UCI moves played from `fen` to SAN (falls back per move). */
export function uciToSanList(fen: string, uciMoves: string[]): string[] {
  const g = new Chess(fen)
  return uciMoves.map((uci) => playUci(g, uci) ?? uci)
}
