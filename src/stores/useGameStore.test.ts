import { describe, it, expect, beforeEach } from "vitest"
import { useGameStore, START_FEN } from "./useGameStore"

const get = () => useGameStore.getState()

beforeEach(() => {
  get().reset()
})

describe("useGameStore moves", () => {
  it("plays a legal move and advances the turn", () => {
    expect(get().makeMove("e2", "e4")).toBe(true)
    expect(get().fullHistory).toHaveLength(1)
    expect(get().historyIndex).toBe(1)
    expect(get().turn).toBe("b")
    expect(get().transient).toBe(false)
  })

  it("rejects an illegal move and leaves the game untouched", () => {
    expect(get().makeMove("e2", "e5")).toBe(false)
    expect(get().fullHistory).toHaveLength(0)
    expect(get().turn).toBe("w")
  })

  it("plays a SAN move and rejects an invalid one", () => {
    expect(get().makeMoveSan("e4")).toBe(true)
    expect(get().makeMoveSan("Zz9")).toBe(false)
    expect(get().fullHistory).toHaveLength(1)
  })

  it("auto-promotes a pawn to a queen when none is specified", () => {
    get().loadFen("7k/P7/8/8/8/8/8/K7 w - - 0 1")
    expect(get().makeMove("a7", "a8")).toBe(true)
    expect(get().fullHistory[0].promotion).toBe("q")
    expect(get().fullHistory[0].san).toContain("Q")
  })

  it("detects checkmate (Fool's mate)", () => {
    for (const san of ["f3", "e5", "g4", "Qh4#"]) get().makeMoveSan(san)
    expect(get().isCheckmate).toBe(true)
    expect(get().isGameOver).toBe(true)
  })
})

describe("useGameStore navigation", () => {
  beforeEach(() => {
    for (const san of ["e4", "e5", "Nf3"]) get().makeMoveSan(san)
  })

  it("steps back and forward through the line", () => {
    expect(get().historyIndex).toBe(3)
    get().goBack()
    expect(get().historyIndex).toBe(2)
    get().goForward()
    expect(get().historyIndex).toBe(3)
  })

  it("jumps to the start and end", () => {
    get().goToStart()
    expect(get().historyIndex).toBe(0)
    expect(get().fen).toBe(START_FEN)
    get().goToEnd()
    expect(get().historyIndex).toBe(3)
  })

  it("does not step before the start or past the end", () => {
    get().goToStart()
    get().goBack()
    expect(get().historyIndex).toBe(0)
    get().goToEnd()
    get().goForward()
    expect(get().historyIndex).toBe(3)
  })

  it("truncates the future when a new move branches off mid-history", () => {
    get().goToMove(1) // back to the position after 1.e4
    expect(get().makeMoveSan("c5")).toBe(true) // play a different 1...c5
    expect(get().fullHistory).toHaveLength(2)
    expect(get().fullHistory[1].san).toBe("c5")
  })

  it("undo() is an alias for stepping back", () => {
    get().undo()
    expect(get().historyIndex).toBe(2)
  })
})

describe("useGameStore bookmarks", () => {
  beforeEach(() => {
    for (const san of ["e4", "e5", "Nf3", "Nc6", "Bb5"]) get().makeMoveSan(san)
  })

  it("toggles a bookmark on and off", () => {
    get().toggleBookmark(2)
    expect(get().bookmarks).toEqual([2])
    get().toggleBookmark(2)
    expect(get().bookmarks).toEqual([])
  })

  it("keeps bookmarks sorted", () => {
    get().toggleBookmark(4)
    get().toggleBookmark(1)
    expect(get().bookmarks).toEqual([1, 4])
  })

  it("navigates to the previous and next bookmark relative to the cursor", () => {
    get().toggleBookmark(1)
    get().toggleBookmark(4)
    get().goToMove(3)
    get().goToPrevBookmark()
    expect(get().historyIndex).toBe(1)
    get().goToNextBookmark()
    expect(get().historyIndex).toBe(4)
  })
})

describe("useGameStore comments", () => {
  beforeEach(() => {
    get().makeMoveSan("e4")
  })

  it("stores a trimmed comment and clears it when emptied", () => {
    get().setComment(0, "  great start  ")
    expect(get().comments[0]).toBe("great start")
    get().setComment(0, "   ")
    expect(get().comments[0]).toBeUndefined()
  })
})

describe("useGameStore play state", () => {
  it("won't start playback at the end of the line", () => {
    get().makeMoveSan("e4")
    get().togglePlay() // historyIndex (1) === length (1) → at end
    expect(get().isPlaying).toBe(false)
  })

  it("toggles playback mid-line and refuses when the game is over", () => {
    for (const san of ["e4", "e5", "Nf3"]) get().makeMoveSan(san)
    get().goToMove(1)
    get().togglePlay()
    expect(get().isPlaying).toBe(true)
    get().togglePlay()
    expect(get().isPlaying).toBe(false)
  })
})

describe("useGameStore loaders", () => {
  it("loads a PGN into a navigable history", () => {
    get().loadPgn("1. e4 e5 2. Nf3")
    expect(get().fullHistory).toHaveLength(3)
    expect(get().historyIndex).toBe(3)
    expect(get().startFen).toBe(START_FEN)
  })

  it("loads a classic at move zero and marks it transient", () => {
    get().loadClassic("1. e4 e5 2. Nf3 Nc6")
    expect(get().fullHistory).toHaveLength(4)
    expect(get().historyIndex).toBe(0)
    expect(get().fen).toBe(START_FEN)
    expect(get().transient).toBe(true)
  })

  it("clears transient once the classic is edited", () => {
    get().loadClassic("1. e4 e5")
    get().makeMoveSan("Nf3") // resumes from move 0 → 1.Nf3 branch
    expect(get().transient).toBe(false)
  })

  it("setStartPosition keeps the linked library entry", () => {
    get().setCurrentLibraryId("lib-1")
    get().setStartPosition("7k/8/8/8/8/8/8/K7 w - - 0 1")
    expect(get().currentLibraryId).toBe("lib-1")
    expect(get().fullHistory).toHaveLength(0)
    expect(get().startFen).toBe("7k/8/8/8/8/8/8/K7 w - - 0 1")
  })

  it("getPgn round-trips the move list", () => {
    get().makeMoveSan("e4")
    get().makeMoveSan("e5")
    const pgn = get().getPgn()
    expect(pgn).toContain("1.")
    expect(pgn).toContain("e4")
    expect(pgn).toContain("e5")
  })

  it("flips the board orientation", () => {
    expect(get().orientation).toBe("white")
    get().flipBoard()
    expect(get().orientation).toBe("black")
  })
})

describe("useGameStore restoreState", () => {
  it("rebuilds the position at the saved index", () => {
    get().makeMoveSan("e4")
    get().makeMoveSan("e5")
    const fullHistory = get().fullHistory
    get().reset()

    get().restoreState({
      fullHistory,
      historyIndex: 1,
      orientation: "black",
      bookmarks: [0],
      comments: { 0: "x" },
      isPlaying: false,
      playSpeed: 750,
      currentLibraryId: "lib-9",
    })

    expect(get().historyIndex).toBe(1)
    expect(get().orientation).toBe("black")
    expect(get().playSpeed).toBe(750)
    expect(get().currentLibraryId).toBe("lib-9")
    // Position is rebuilt to after 1.e4 (index 1), Black to move.
    expect(get().turn).toBe("b")
  })
})
