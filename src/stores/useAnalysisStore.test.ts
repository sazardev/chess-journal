import { describe, it, expect, beforeEach } from "vitest"
import { useAnalysisStore, posKey } from "./useAnalysisStore"
import type { PlyEval } from "../lib/moveQuality"

function ev(depth: number): PlyEval {
  return { evalWhite: 0, bestUci: null, gap: null, depth }
}

const FEN_A = "rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq e3 0 1"
// Same position, different half/full-move clocks → must share a key.
const FEN_A_LATER = "rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq e3 5 9"

describe("posKey", () => {
  it("drops the halfmove and fullmove clocks", () => {
    expect(posKey(FEN_A)).toBe("rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq e3")
  })

  it("maps the same position with different clocks to one key", () => {
    expect(posKey(FEN_A)).toBe(posKey(FEN_A_LATER))
  })
})

describe("useAnalysisStore.record", () => {
  beforeEach(() => {
    useAnalysisStore.setState({ byFen: {}, markMode: false })
  })

  it("stores an eval keyed by normalized position", () => {
    useAnalysisStore.getState().record(FEN_A, ev(10))
    expect(useAnalysisStore.getState().byFen[posKey(FEN_A)]?.depth).toBe(10)
  })

  it("keeps the deepest eval and ignores shallower ones", () => {
    const store = useAnalysisStore.getState()
    store.record(FEN_A, ev(10))
    store.record(FEN_A, ev(8)) // shallower → ignored
    expect(useAnalysisStore.getState().byFen[posKey(FEN_A)]?.depth).toBe(10)
    store.record(FEN_A, ev(14)) // deeper → replaces
    expect(useAnalysisStore.getState().byFen[posKey(FEN_A)]?.depth).toBe(14)
  })

  it("treats clock-only FEN differences as the same cached position", () => {
    useAnalysisStore.getState().record(FEN_A, ev(12))
    // A later visit to the same position should hit the cached entry.
    expect(useAnalysisStore.getState().byFen[posKey(FEN_A_LATER)]?.depth).toBe(12)
  })
})

describe("useAnalysisStore mark toggle", () => {
  beforeEach(() => useAnalysisStore.setState({ byFen: {}, markMode: false }))

  it("toggles and sets the mark mode", () => {
    useAnalysisStore.getState().toggleMark()
    expect(useAnalysisStore.getState().markMode).toBe(true)
    useAnalysisStore.getState().setMark(false)
    expect(useAnalysisStore.getState().markMode).toBe(false)
  })

  it("clears the eval cache", () => {
    useAnalysisStore.getState().record(FEN_A, ev(10))
    useAnalysisStore.getState().clear()
    expect(useAnalysisStore.getState().byFen).toEqual({})
  })
})
