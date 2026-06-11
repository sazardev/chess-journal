import { describe, it, expect } from "vitest"
import type { PlyEval } from "./moveQuality"
import { MATE_BASE } from "./moveQuality"
import type { Motif } from "./motifs"
import { explainMove, formatEval, type ExplainInput } from "./explain"

function ev(evalWhite: number, over: Partial<PlyEval> = {}): PlyEval {
  return { evalWhite, bestUci: null, gap: null, depth: 20, ...over }
}

function input(over: Partial<ExplainInput>): ExplainInput {
  return {
    moverIsWhite: true,
    before: ev(0),
    after: ev(0),
    nag: null,
    motifs: [],
    bestSan: null,
    isBookMove: false,
    ...over,
  }
}

describe("formatEval", () => {
  it("formats centipawns as signed pawns", () => {
    expect(formatEval(120)).toBe("+1.2")
    expect(formatEval(-310)).toBe("-3.1")
    expect(formatEval(0)).toBe("+0.0")
  })
  it("formats mate scores", () => {
    expect(formatEval(MATE_BASE - 3)).toBe("M3")
    expect(formatEval(-(MATE_BASE - 2))).toBe("-M2")
  })
})

describe("explainMove", () => {
  it("returns null when both sides of the move are uncached", () => {
    expect(explainMove(input({ before: undefined, after: undefined }))).toBeNull()
  })

  it("flags a book move without penalising it", () => {
    const r = explainMove(input({ isBookMove: true, nag: "??" }))
    expect(r?.tone).toBe("book")
    expect(r?.text).toBe("Book move (theory).")
  })

  it("describes a hanging-piece blunder and names the best move", () => {
    const motifs: Motif[] = [{ kind: "hangsPiece", square: "c4", piece: "b", material: 330 }]
    const r = explainMove(
      input({ before: ev(0), after: ev(-300), nag: "??", motifs, bestSan: "Nf3" }),
    )
    expect(r?.tone).toBe("blunder")
    expect(r?.text).toContain("Hangs the bishop on c4")
    expect(r?.text).toContain("Best was Nf3")
  })

  it("celebrates a checkmate as a strong move", () => {
    const r = explainMove(input({ nag: "!", motifs: [{ kind: "checkmate", square: "h7" }] }))
    expect(r?.text).toBe("Checkmate!")
    expect(r?.tone).toBe("good")
  })

  it("mentions a fork on a strong move", () => {
    const r = explainMove(
      input({ nag: "!!", motifs: [{ kind: "fork", square: "f6", piece: "r", targets: ["e8", "g8"] }] }),
    )
    expect(r?.text).toContain("forks the rook")
  })

  it("gives a low-key neutral note with the eval", () => {
    const r = explainMove(input({ before: ev(30), after: ev(20), nag: null }))
    expect(r?.tone).toBe("neutral")
    expect(r?.text).toContain("Solid move")
    expect(r?.text).toContain("+0.2")
  })
})
