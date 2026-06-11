import { describe, it, expect } from "vitest"
import { computeHeatmap, candidateColor } from "./heatmap"
import type { Candidate } from "../hooks/useEngine"

function cand(over: Partial<Candidate> = {}): Candidate {
  return { uci: "e2e4", score: 0, mate: null, multipv: 1, ...over }
}

const GOOD = "rgb(22, 163, 74)"
const BAD = "rgb(220, 38, 38)"

describe("computeHeatmap", () => {
  it("returns empty styles and arrows for no candidates", () => {
    expect(computeHeatmap([])).toEqual({ squareStyles: {}, arrows: [] })
  })

  it("colours the best move green with a full-strength arrow", () => {
    const { squareStyles, arrows } = computeHeatmap([cand({ uci: "e2e4", score: 50 })])
    expect(squareStyles["e4"]).toEqual({ backgroundColor: "rgba(22, 163, 74, 0.3)" })
    expect(arrows).toEqual([
      { startSquare: "e2", endSquare: "e4", color: "rgba(22, 163, 74, 0.7)" },
    ])
  })

  it("colours a clearly worse move red and fades its arrow", () => {
    const { squareStyles, arrows } = computeHeatmap([
      cand({ uci: "e2e4", score: 50, multipv: 1 }),
      cand({ uci: "d2d4", score: -100, multipv: 2 }),
    ])
    expect(squareStyles["e4"]).toEqual({ backgroundColor: "rgba(22, 163, 74, 0.3)" })
    expect(squareStyles["d4"]).toEqual({ backgroundColor: "rgba(220, 38, 38, 0.25)" })
    expect(arrows[1].startSquare).toBe("d2")
    expect(arrows[1].endSquare).toBe("d4")
    // The worse move is red; opacity fades for the 2nd line (~0.5, modulo float).
    expect(arrows[1].color).toMatch(/^rgba\(220, 38, 38, 0\.49/)
  })

  it("sorts by multipv so the lowest-index line is treated as best", () => {
    const { squareStyles } = computeHeatmap([
      cand({ uci: "d2d4", score: -100, multipv: 2 }),
      cand({ uci: "e2e4", score: 50, multipv: 1 }),
    ])
    // e4 is the best move (multipv 1) regardless of array order → green.
    expect(squareStyles["e4"]).toEqual({ backgroundColor: "rgba(22, 163, 74, 0.3)" })
  })

  it("treats a mate as overwhelmingly best", () => {
    const { squareStyles } = computeHeatmap([cand({ uci: "h7h8", mate: 1, multipv: 1 })])
    expect(squareStyles["h8"]).toEqual({ backgroundColor: "rgba(22, 163, 74, 0.3)" })
  })

  it("draws arrows for at most the top three moves", () => {
    const { arrows } = computeHeatmap([
      cand({ uci: "e2e4", multipv: 1 }),
      cand({ uci: "d2d4", multipv: 2 }),
      cand({ uci: "g1f3", multipv: 3 }),
      cand({ uci: "b1c3", multipv: 4 }),
    ])
    expect(arrows).toHaveLength(3)
  })

  it("lets the best move win a shared destination square", () => {
    const { squareStyles } = computeHeatmap([
      cand({ uci: "e2e4", score: 50, multipv: 1 }),
      cand({ uci: "d3e4", score: -300, multipv: 2 }),
    ])
    // Both target e4; the best (multipv 1, green) keeps the square.
    expect(squareStyles["e4"]).toEqual({ backgroundColor: "rgba(22, 163, 74, 0.3)" })
  })
})

describe("candidateColor", () => {
  it("is neutral grey when there are no candidates", () => {
    expect(candidateColor([], cand())).toBe("rgb(163, 163, 163)")
  })

  it("paints the best candidate green", () => {
    const best = cand({ uci: "e2e4", score: 50, multipv: 1 })
    expect(candidateColor([best], best)).toBe(GOOD)
  })

  it("paints a candidate losing ≥150cp fully red", () => {
    const best = cand({ uci: "e2e4", score: 50, multipv: 1 })
    const worse = cand({ uci: "a2a3", score: -100, multipv: 2 })
    expect(candidateColor([best, worse], worse)).toBe(BAD)
  })
})
