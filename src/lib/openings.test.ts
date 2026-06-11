import { describe, it, expect } from "vitest"
import { Chess, type Move } from "chess.js"
import { detectOpening, loadOpenings, getOpeningsCache } from "./openings"

// Mirror the (private) position-key normalization used by the module.
function posKey(fen: string): string {
  return fen.split(" ").slice(0, 4).join(" ")
}

// Real moves carry the `.after` FEN that detectOpening keys on.
function line(...sans: string[]): Move[] {
  const chess = new Chess()
  for (const san of sans) chess.move(san)
  return chess.history({ verbose: true })
}

describe("detectOpening", () => {
  it("returns the deepest known line the game passes through", () => {
    const history = line("e4", "c5") // King's pawn → Sicilian
    const map = {
      [posKey(history[0].after)]: { eco: "B00", name: "King's Pawn Game", ply: 1 },
      [posKey(history[1].after)]: { eco: "B20", name: "Sicilian Defense", ply: 2 },
    }
    expect(detectOpening(history, map)).toEqual({
      eco: "B20",
      name: "Sicilian Defense",
      lastBookPly: 2,
    })
  })

  it("reports the last in-book ply when the game leaves theory early", () => {
    const history = line("e4", "c5", "Nf3")
    const map = {
      [posKey(history[0].after)]: { eco: "B00", name: "King's Pawn Game", ply: 1 },
    }
    const info = detectOpening(history, map)
    expect(info?.name).toBe("King's Pawn Game")
    expect(info?.lastBookPly).toBe(1)
  })

  it("picks the deepest match even when an intermediate ply is unknown", () => {
    const history = line("e4", "c5", "Nf3")
    const map = {
      [posKey(history[0].after)]: { eco: "B00", name: "King's Pawn Game", ply: 1 },
      // ply 2 deliberately absent from the book
      [posKey(history[2].after)]: { eco: "B27", name: "Sicilian, Nf3", ply: 3 },
    }
    expect(detectOpening(history, map)?.lastBookPly).toBe(3)
  })

  it("returns null when nothing matches", () => {
    expect(detectOpening(line("e4", "e5"), {})).toBeNull()
  })

  it("skips plies without an `after` FEN", () => {
    const synthetic = [{ san: "e4" } as Move]
    expect(detectOpening(synthetic, {})).toBeNull()
  })
})

describe("loadOpenings", () => {
  it("loads a populated ECO map and caches it by reference", async () => {
    const map = await loadOpenings()
    expect(Object.keys(map).length).toBeGreaterThan(100)
    // After loading, the synchronous cache accessor returns the same object.
    expect(getOpeningsCache()).toBe(map)
    // A second load is a cache hit, not a re-import.
    expect(await loadOpenings()).toBe(map)
  })
})
