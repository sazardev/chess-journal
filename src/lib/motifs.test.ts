import { describe, it, expect } from "vitest"
import { Chess, type Move } from "chess.js"
import { detectMotifs, isHanging, PIECE_VALUE, pieceName, type Motif } from "./motifs"

/** Play a SAN move from a FEN and return the resulting chess.js Move. */
function play(fen: string, san: string): Move {
  const g = new Chess(fen)
  const m = g.move(san)
  return m
}

const has = (ms: Motif[], kind: Motif["kind"]) => ms.some((m) => m.kind === kind)
const get = (ms: Motif[], kind: Motif["kind"]) => ms.find((m) => m.kind === kind)

describe("PIECE_VALUE", () => {
  it("orders the pieces sensibly (q > r > b ≥ n > p, k = 0)", () => {
    expect(PIECE_VALUE.q).toBeGreaterThan(PIECE_VALUE.r)
    expect(PIECE_VALUE.r).toBeGreaterThan(PIECE_VALUE.b)
    expect(PIECE_VALUE.b).toBeGreaterThanOrEqual(PIECE_VALUE.n)
    expect(PIECE_VALUE.n).toBeGreaterThan(PIECE_VALUE.p)
    expect(PIECE_VALUE.k).toBe(0)
  })
})

describe("isHanging", () => {
  it("flags an attacked, undefended piece", () => {
    // White knight on c4 is attacked by the d5 pawn and has no defender.
    const c = new Chess("4k3/8/8/3p4/2N5/8/8/4K3 w - - 0 1")
    expect(isHanging(c, "c4", "w")).toBe(true)
  })

  it("does not flag a defended piece attacked only by an equal/greater piece", () => {
    // White rook on d4: attacked by the d8 queen (900) but defended by the d1
    // rook — the opponent can't win material on the trade.
    const c = new Chess("3qk3/8/8/8/3R4/8/8/3RK3 w - - 0 1")
    expect(isHanging(c, "d4", "w")).toBe(false)
  })

  it("returns false for a square the owner doesn't occupy", () => {
    const c = new Chess("4k3/8/8/3p4/2N5/8/8/4K3 w - - 0 1")
    expect(isHanging(c, "a1", "w")).toBe(false)
  })
})

describe("detectMotifs", () => {
  it("detects a capture and its material", () => {
    const m = play("rnbqkbnr/ppp1pppp/8/3p4/4P3/8/PPPP1PPP/RNBQKBNR w KQkq d6 0 2", "exd5")
    const motifs = detectMotifs(m)
    const cap = get(motifs, "capture")
    expect(cap).toBeTruthy()
    expect(cap?.piece).toBe("p")
    expect(cap?.material).toBe(PIECE_VALUE.p)
  })

  it("distinguishes a recapture from a fresh capture using the previous move", () => {
    const g = new Chess("rnbqkbnr/ppp1pppp/8/3p4/4P3/8/PPPP1PPP/RNBQKBNR w KQkq d6 0 2")
    const wm = g.move("exd5") // white captures on d5
    const bm = g.move("Qxd5") // black recaptures on d5
    expect(has(detectMotifs(bm, wm), "recapture")).toBe(true)
    expect(has(detectMotifs(bm, wm), "capture")).toBe(false)
  })

  it("flags a piece left hanging by the move", () => {
    // Knight from e3 to c4, walking into the d5 pawn with no support.
    const m = play("4k3/8/8/3p4/8/4N3/8/4K3 w - - 0 1", "Nc4")
    const hang = get(detectMotifs(m), "hangsPiece")
    expect(hang).toBeTruthy()
    expect(hang?.piece).toBe("n")
  })

  it("detects a knight fork of the king and rook", () => {
    const m = play("4r1k1/8/8/8/4N3/8/8/5K2 w - - 0 1", "Nf6")
    const motifs = detectMotifs(m)
    const fork = get(motifs, "fork")
    expect(fork).toBeTruthy()
    expect(fork?.targets?.length).toBeGreaterThanOrEqual(2)
    expect(fork?.piece).toBe("r") // best (non-king) target
    expect(has(motifs, "check")).toBe(true)
  })

  it("detects a check that isn't mate", () => {
    const motifs = detectMotifs(play("4k3/8/8/8/8/8/8/Q3K3 w - - 0 1", "Qa8"))
    expect(has(motifs, "check")).toBe(true)
    expect(has(motifs, "checkmate")).toBe(false)
  })

  it("detects checkmate and ranks it first", () => {
    const motifs = detectMotifs(play("6k1/5ppp/8/8/8/8/8/R5K1 w - - 0 1", "Ra8"))
    expect(has(motifs, "checkmate")).toBe(true)
    expect(motifs[0].kind).toBe("checkmate")
  })

  it("detects a promotion", () => {
    const prom = get(detectMotifs(play("8/1P6/4k3/8/8/8/8/4K3 w - - 0 1", "b8=Q")), "promotion")
    expect(prom).toBeTruthy()
    expect(prom?.piece).toBe("q")
  })
})

describe("pieceName", () => {
  it("spells out each piece", () => {
    expect(pieceName("n")).toBe("knight")
    expect(pieceName("q")).toBe("queen")
    expect(pieceName("k")).toBe("king")
  })
})
