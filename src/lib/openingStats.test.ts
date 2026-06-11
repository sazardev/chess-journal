import { describe, it, expect } from "vitest"
import type { Move } from "chess.js"
import { aggregateOpenings } from "./openingStats"
import type { LibraryEntry } from "../stores/useLibraryStore"
import type { GameResult, PlayerColor } from "../types/save"

interface EntryOpts {
  name?: string
  eco?: string
  bookPly?: number
  plies?: number
  result?: GameResult
  color?: PlayerColor
}

let counter = 0
function entry({ name, eco, bookPly, plies = 0, result, color }: EntryOpts): LibraryEntry {
  counter += 1
  return {
    id: `e${counter}`,
    pinned: false,
    favorite: false,
    savedAt: "2026-01-01T00:00:00.000Z",
    data: {
      version: 1,
      meta: {
        name: "Game",
        rating: 0,
        tags: [],
        notes: "",
        createdAt: "2026-01-01T00:00:00.000Z",
        updatedAt: "2026-01-01T00:00:00.000Z",
        opening: name ? { eco: eco ?? "A00", name, ply: bookPly } : undefined,
        result,
        playerColor: color,
      },
      game: {
        fullHistory: Array.from({ length: plies }) as unknown as Move[],
        historyIndex: plies,
        orientation: "white",
        bookmarks: [],
        comments: {},
        isPlaying: false,
        playSpeed: 500,
        currentLibraryId: null,
      },
      board: { arrows: [], highlights: {}, annotationHistory: [] },
    },
  }
}

describe("aggregateOpenings", () => {
  it("groups games by opening name and counts wins/losses/draws by colour", () => {
    const stats = aggregateOpenings([
      entry({ name: "Sicilian Defense", result: "1-0", color: "white" }), // win
      entry({ name: "Sicilian Defense", result: "0-1", color: "white" }), // loss
      entry({ name: "Sicilian Defense", result: "1/2-1/2", color: "white" }), // draw
    ])
    expect(stats).toHaveLength(1)
    const s = stats[0]
    expect(s.games).toBe(3)
    expect(s.wins).toBe(1)
    expect(s.losses).toBe(1)
    expect(s.draws).toBe(1)
    expect(s.rated).toBe(3)
  })

  it("scores a win from Black's side correctly", () => {
    const [s] = aggregateOpenings([entry({ name: "French", result: "0-1", color: "black" })])
    expect(s.wins).toBe(1)
    expect(s.losses).toBe(0)
  })

  it("does not rate games missing a result or player colour", () => {
    const [s] = aggregateOpenings([
      entry({ name: "Caro-Kann", result: "1-0" }), // no colour
      entry({ name: "Caro-Kann", color: "white" }), // no result
      entry({ name: "Caro-Kann", result: "*", color: "white" }), // in-progress
    ])
    expect(s.games).toBe(3)
    expect(s.rated).toBe(0)
    expect(s.wins + s.losses + s.draws).toBe(0)
  })

  it("buckets games without a detected opening under Unknown", () => {
    const [s] = aggregateOpenings([entry({})])
    expect(s.name).toBe("Unknown")
    expect(s.eco).toBe("—")
  })

  it("averages full moves and book depth, rounding to whole moves", () => {
    const [s] = aggregateOpenings([
      entry({ name: "Italian", plies: 40, bookPly: 8 }),
      entry({ name: "Italian", plies: 20, bookPly: 12 }),
    ])
    // (40 + 20) plies / 2 games / 2 = 15 full moves
    expect(s.avgMoves).toBe(15)
    // (8 + 12) book plies / 2 / 2 = 5 full moves
    expect(s.avgBook).toBe(5)
  })

  it("reports avgBook 0 when no game recorded a book depth", () => {
    const [s] = aggregateOpenings([entry({ name: "Bongcloud", plies: 10 })])
    expect(s.avgBook).toBe(0)
  })

  it("sorts openings by frequency, most-played first", () => {
    const stats = aggregateOpenings([
      entry({ name: "Rare" }),
      entry({ name: "Common" }),
      entry({ name: "Common" }),
    ])
    expect(stats.map((s) => s.name)).toEqual(["Common", "Rare"])
  })
})
