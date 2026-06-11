import { describe, it, expect } from "vitest"
import type { Move } from "chess.js"
import type { PlyEval } from "../moveQuality"
import { buildMoveContext, phaseOf } from "./explainContext"

function ev(evalWhite: number, over: Partial<PlyEval> = {}): PlyEval {
  return { evalWhite, bestUci: null, gap: null, depth: 20, ...over }
}
function mv(over: Partial<Move>): Move {
  return {
    color: "w",
    from: "e2",
    to: "e4",
    piece: "p",
    san: "e4",
    lan: "e2e4",
    before: "p0",
    after: "p1",
    flags: "",
    ...over,
  } as unknown as Move
}

describe("phaseOf", () => {
  it("buckets plies into thirds", () => {
    expect(phaseOf(0, 30)).toBe("opening")
    expect(phaseOf(15, 30)).toBe("middlegame")
    expect(phaseOf(25, 30)).toBe("endgame")
  })
})

describe("buildMoveContext", () => {
  it("derives nag, cpLoss, book flag and phase", () => {
    const ctx = buildMoveContext({
      mv: mv({ color: "w", san: "Qh5", lan: "d1h5" }),
      before: ev(0),
      after: ev(-300),
      motifs: [],
      ply: 2,
      totalPlies: 30,
      lastBookPly: 4,
      openingName: "Italian Game",
    })
    expect(ctx.nag).toBe("??")
    expect(ctx.cpLoss).toBe(300)
    expect(ctx.isBookMove).toBe(true) // ply 2 < bookPlies 4
    expect(ctx.phase).toBe("opening")
    expect(ctx.san).toBe("Qh5")
  })

  it("uses move.color for the mover (correct for custom starts)", () => {
    const ctx = buildMoveContext({
      mv: mv({ color: "b" }),
      before: ev(0),
      after: ev(0),
      motifs: [],
      ply: 0,
      totalPlies: 1,
      lastBookPly: 0,
      openingName: null,
    })
    expect(ctx.moverIsWhite).toBe(false)
  })
})
