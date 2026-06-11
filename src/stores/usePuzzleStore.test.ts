import { describe, it, expect, beforeEach, afterEach, vi } from "vitest"
import { usePuzzleStore } from "./usePuzzleStore"
import { usePuzzleProgressStore } from "./usePuzzleProgressStore"
import { usePersistenceStore } from "./usePersistenceStore"
import { START_FEN } from "./useGameStore"
import type { Puzzle } from "../data/puzzles"

const get = () => usePuzzleStore.getState()

function puzzle(over: Partial<Puzzle> = {}): Puzzle {
  return {
    id: "p1",
    title: "Test",
    description: "White to move and mate",
    fen: "6k1/5ppp/8/8/8/8/8/R6K w - - 0 1", // 1.Ra8#
    solution: ["a1a8"],
    playerColor: "w",
    mateIn: 1,
    theme: "mate",
    difficulty: "easy",
    rating: 1000,
    source: "test",
    ...over,
  }
}

beforeEach(() => {
  usePersistenceStore.setState({ ready: true, dataDir: "__local__" })
  usePuzzleProgressStore.setState({ progress: {}, loaded: true })
  get().exit()
})

afterEach(() => {
  get().exit()
  vi.useRealTimers()
})

describe("usePuzzleStore.load", () => {
  it("starts a puzzle from its FEN, oriented to the side to move", () => {
    get().load([puzzle()], 0)
    expect(get().active).toBe(true)
    expect(get().orientation).toBe("white")
    expect(get().solutionIndex).toBe(0)
    expect(get().status).toBe("playing")
    expect(get().mistakes).toBe(0)
  })
})

describe("usePuzzleStore.attemptMove", () => {
  it("solves a mate-in-one with the scripted move and records progress", () => {
    get().load([puzzle()], 0)
    expect(get().attemptMove("a1", "a8")).toBe(true)
    expect(get().status).toBe("solved")
    expect(usePuzzleProgressStore.getState().progress["p1"]?.solved).toBe(true)
  })

  it("counts a legal-but-wrong move as a mistake without solving", () => {
    get().load([puzzle()], 0)
    expect(get().attemptMove("a1", "a4")).toBe(false)
    expect(get().mistakes).toBe(1)
    expect(get().status).toBe("playing")
  })

  it("silently snaps back an illegal move (not a mistake)", () => {
    get().load([puzzle()], 0)
    expect(get().attemptMove("h1", "h4")).toBe(false) // king can't leap 3 squares
    expect(get().mistakes).toBe(0)
    expect(get().status).toBe("playing")
  })

  it("accepts an alternative checkmate on the final move (mate leniency)", () => {
    // Both 1.Qg7# and 1.Qg8# mate; the book records only g1g7.
    get().load([puzzle({ id: "alt", fen: "7k/5K2/8/8/8/8/8/6Q1 w - - 0 1", solution: ["g1g7"] })], 0)
    expect(get().attemptMove("g1", "g8")).toBe(true)
    expect(get().status).toBe("solved")
  })

  it("plays the opponent's scripted reply, then accepts the final move", () => {
    vi.useFakeTimers()
    // Synthetic line exercising the state machine: player, scripted reply, player.
    const seq = puzzle({
      id: "seq",
      fen: START_FEN,
      solution: ["e2e4", "e7e5", "g1f3"],
      mateIn: 2,
    })
    get().load([seq], 0)

    expect(get().attemptMove("e2", "e4")).toBe(true)
    expect(get().solutionIndex).toBe(1)
    expect(get().locked).toBe(true) // waiting on the scripted reply

    vi.advanceTimersByTime(400) // opponent replies 1...e5
    expect(get().locked).toBe(false)
    expect(get().solutionIndex).toBe(2)

    expect(get().attemptMove("g1", "f3")).toBe(true)
    expect(get().status).toBe("solved")
  })

  it("refuses input while locked during the opponent reply", () => {
    vi.useFakeTimers()
    const seq = puzzle({ id: "seq2", fen: START_FEN, solution: ["e2e4", "e7e5", "g1f3"], mateIn: 2 })
    get().load([seq], 0)
    get().attemptMove("e2", "e4")
    expect(get().locked).toBe(true)
    expect(get().attemptMove("g1", "f3")).toBe(false) // locked → rejected
  })
})

describe("usePuzzleStore navigation", () => {
  const queue = [puzzle({ id: "a" }), puzzle({ id: "b" })]

  it("advances to the next puzzle", () => {
    get().load(queue, 0)
    expect(get().hasNext).toBe(true)
    get().next()
    expect(get().queueIndex).toBe(1)
    expect(get().hasNext).toBe(false)
    expect(get().puzzle?.id).toBe("b")
  })

  it("retries the current puzzle, resetting mistakes", () => {
    get().load(queue, 0)
    get().attemptMove("a1", "a4") // a mistake
    expect(get().mistakes).toBe(1)
    get().retry()
    expect(get().mistakes).toBe(0)
    expect(get().queueIndex).toBe(0)
  })

  it("exits and tears down the session", () => {
    get().load(queue, 0)
    get().exit()
    expect(get().active).toBe(false)
    expect(get().puzzle).toBeNull()
    expect(get().queue).toEqual([])
  })
})
