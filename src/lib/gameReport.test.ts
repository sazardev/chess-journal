import { describe, it, expect } from "vitest"
import type { Move } from "chess.js"
import type { PlyEval } from "./moveQuality"
import { buildGameReport, winPct, moveAccuracy, acplToEloBand, summarizeReport } from "./gameReport"

// Minimal Move stand-in. `before`/`after` use space-free tokens so posKey (which
// keeps the first 4 FEN fields) maps each to a distinct byFen key.
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

function ev(evalWhite: number, over: Partial<PlyEval> = {}): PlyEval {
  return { evalWhite, bestUci: null, gap: null, depth: 20, ...over }
}

describe("winPct", () => {
  it("is 50% at an even position", () => {
    expect(winPct(0)).toBeCloseTo(50, 5)
  })
  it("increases monotonically with the eval", () => {
    expect(winPct(100)).toBeGreaterThan(winPct(0))
    expect(winPct(0)).toBeGreaterThan(winPct(-100))
  })
  it("saturates near 0 / 100 at decisive evals", () => {
    expect(winPct(100000)).toBeGreaterThan(99)
    expect(winPct(-100000)).toBeLessThan(1)
  })
})

describe("moveAccuracy", () => {
  it("is ~100 when the move keeps the win% steady", () => {
    expect(moveAccuracy(50, 50)).toBeGreaterThan(99)
  })
  it("never exceeds 100 even if the eval improves", () => {
    expect(moveAccuracy(50, 70)).toBeLessThanOrEqual(100)
  })
  it("drops and clamps at 0 for a large win% loss", () => {
    const acc = moveAccuracy(80, 10)
    expect(acc).toBeGreaterThanOrEqual(0)
    expect(acc).toBeLessThan(50)
  })
})

describe("acplToEloBand", () => {
  it("maps anchor ACPLs to their rating bands", () => {
    expect(acplToEloBand(40).band).toBe("~1600")
    expect(acplToEloBand(20).band).toBe("~2100")
  })
  it("is monotonic — higher ACPL means a lower band", () => {
    expect(acplToEloBand(40).low).toBeLessThan(acplToEloBand(20).low)
    expect(acplToEloBand(80).high).toBeLessThan(acplToEloBand(30).high)
  })
})

describe("buildGameReport", () => {
  const byFen = { p0: ev(0), p1: ev(-300), p2: ev(-290) }
  const game: Move[] = [
    mv({ color: "w", before: "p0", after: "p1", san: "Qh5", lan: "d1h5" }),
    mv({ color: "b", before: "p1", after: "p2", san: "Nc6", lan: "b8c6" }),
  ]

  it("splits scoring by move colour and counts the blunder", () => {
    const r = buildGameReport(game, byFen)
    expect(r.white.scored).toBe(1)
    expect(r.white.blunders).toBe(1)
    expect(r.black.scored).toBe(1)
    expect(r.black.blunders).toBe(0)
    expect(r.coveredPlies).toBe(2)
    expect(r.totalPlies).toBe(2)
  })

  it("surfaces the blunder as a ranked improvement", () => {
    const r = buildGameReport(game, byFen)
    expect(r.improvements).toHaveLength(1)
    expect(r.improvements[0].ply).toBe(0)
    expect(r.improvements[0].kind).toBe("blunder")
  })

  it("excludes opening-theory plies from scoring", () => {
    const r = buildGameReport(game, byFen, { bookPlies: 1 })
    expect(r.white.scored).toBe(0)
    expect(r.white.blunders).toBe(0)
    expect(r.black.scored).toBe(1)
    expect(r.improvements).toHaveLength(0)
    expect(r.coveredPlies).toBe(2) // still counts as covered
  })

  it("skips plies missing an eval without producing NaN", () => {
    const partial = { p0: ev(0), p1: ev(-300), p3: ev(-300) } // p2 absent
    const longer: Move[] = [
      mv({ color: "w", before: "p0", after: "p1" }),
      mv({ color: "b", before: "p1", after: "p2" }), // after missing → skipped
      mv({ color: "w", before: "p2", after: "p3" }), // before missing → skipped
    ]
    const r = buildGameReport(longer, partial)
    expect(r.coveredPlies).toBe(1)
    expect(Number.isFinite(r.white.acpl)).toBe(true)
    expect(Number.isFinite(r.black.accuracy)).toBe(true)
  })

  it("attributes the first move to Black for a custom start position", () => {
    const r = buildGameReport(
      [mv({ color: "b", before: "p0", after: "p1", san: "e5", lan: "e7e5" })],
      { p0: ev(0), p1: ev(20) },
    )
    expect(r.black.scored).toBe(1)
    expect(r.white.scored).toBe(0)
  })
})

describe("summarizeReport", () => {
  const byFen = { p0: ev(0), p1: ev(-300), p2: ev(-290) }
  const game: Move[] = [
    mv({ color: "w", before: "p0", after: "p1", san: "Qh5", lan: "d1h5" }),
    mv({ color: "b", before: "p1", after: "p2", san: "Nc6", lan: "b8c6" }),
  ]

  it("prompts to analyze when nothing is covered", () => {
    expect(summarizeReport(buildGameReport([], {}))).toContain("Run the engine analysis")
  })

  it("summarizes accuracy and names the opening", () => {
    const s = summarizeReport(buildGameReport(game, byFen), "Italian Game")
    expect(s).toContain("White")
    expect(s).toContain("%")
    expect(s).toContain("Italian Game")
  })
})
