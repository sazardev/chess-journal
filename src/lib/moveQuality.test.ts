import { describe, it, expect } from "vitest"
import {
  classifyMove,
  nagColor,
  toWhiteEval,
  MATE_BASE,
  type PlyEval,
} from "./moveQuality"

// A deep-enough eval; override the fields each test cares about.
function ev(over: Partial<PlyEval> = {}): PlyEval {
  return { evalWhite: 0, bestUci: null, gap: null, depth: 20, ...over }
}

describe("toWhiteEval", () => {
  it("returns the centipawn score as-is for White to move", () => {
    expect(toWhiteEval("w", 50, null)).toBe(50)
  })

  it("negates the centipawn score for Black to move", () => {
    expect(toWhiteEval("b", 50, null)).toBe(-50)
  })

  it("maps a White mate to a large positive magnitude", () => {
    expect(toWhiteEval("w", 0, 1)).toBe(MATE_BASE - 1)
  })

  it("maps the opponent mating the White side to a large negative", () => {
    expect(toWhiteEval("w", 0, -1)).toBe(-(MATE_BASE - 1))
  })

  it("flips perspective when Black is to move (a mate-for-Black is negative for White)", () => {
    expect(toWhiteEval("b", 0, 1)).toBe(-(MATE_BASE - 1))
  })

  it("scores a nearer mate as a larger magnitude than a distant one", () => {
    const m1 = toWhiteEval("w", 0, 1)
    const m5 = toWhiteEval("w", 0, 5)
    expect(m1).toBeGreaterThan(m5)
  })
})

describe("classifyMove", () => {
  it("returns null when either side of the move is too shallow", () => {
    expect(classifyMove(true, ev({ depth: 7 }), ev(), "e2e4")).toBeNull()
    expect(classifyMove(true, ev(), ev({ depth: 4 }), "e2e4")).toBeNull()
  })

  it("flags a blunder (??) for a big centipawn loss", () => {
    const nag = classifyMove(true, ev({ evalWhite: 100 }), ev({ evalWhite: -200 }), "e2e4")
    expect(nag).toBe("??")
  })

  it("flags a mistake (?) for a moderate loss", () => {
    const nag = classifyMove(true, ev({ evalWhite: 100 }), ev({ evalWhite: -50 }), "e2e4")
    expect(nag).toBe("?")
  })

  it("flags an inaccuracy (?!) for a small loss", () => {
    const nag = classifyMove(true, ev({ evalWhite: 100 }), ev({ evalWhite: 40 }), "e2e4")
    expect(nag).toBe("?!")
  })

  it("measures loss from Black's perspective when Black moved", () => {
    // Black was winning (-100 for White) then it swung to +100 → Black lost 200cp.
    const nag = classifyMove(false, ev({ evalWhite: -100 }), ev({ evalWhite: 100 }), "e7e5")
    expect(nag).toBe("?")
  })

  it("awards !! for the only good move (huge gap, played best, no loss)", () => {
    const before = ev({ evalWhite: 0, bestUci: "e2e4", gap: 300 })
    const after = ev({ evalWhite: 0 })
    expect(classifyMove(true, before, after, "e2e4")).toBe("!!")
  })

  it("awards ! for an important best move (moderate gap)", () => {
    const before = ev({ evalWhite: 0, bestUci: "e2e4", gap: 150 })
    const after = ev({ evalWhite: 0 })
    expect(classifyMove(true, before, after, "e2e4")).toBe("!")
  })

  it("gives no mark for a best move when the gap is small (obvious move)", () => {
    const before = ev({ evalWhite: 0, bestUci: "e2e4", gap: 50 })
    const after = ev({ evalWhite: 0 })
    expect(classifyMove(true, before, after, "e2e4")).toBeNull()
  })

  it("does not award a brilliancy when a non-best move was played", () => {
    const before = ev({ evalWhite: 0, bestUci: "e2e4", gap: 300 })
    const after = ev({ evalWhite: 0 })
    expect(classifyMove(true, before, after, "d2d4")).toBeNull()
  })

  it("returns null for an accurate, unremarkable move", () => {
    expect(classifyMove(true, ev({ evalWhite: 30 }), ev({ evalWhite: 25 }), "g1f3")).toBeNull()
  })
})

describe("nagColor", () => {
  it("maps each NAG to its heatmap-coherent colour", () => {
    expect(nagColor("!!")).toBe("#15803d")
    expect(nagColor("!")).toBe("#16a34a")
    expect(nagColor("?!")).toBe("#a3a3a3")
    expect(nagColor("?")).toBe("#ea580c")
    expect(nagColor("??")).toBe("#dc2626")
  })
})
