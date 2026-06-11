import { describe, it, expect, beforeEach } from "vitest"
import { useEditorStore } from "./useEditorStore"

const get = () => useEditorStore.getState()
const START = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1"

beforeEach(() => {
  get().enter() // fresh empty board, active
})

describe("useEditorStore", () => {
  it("enters seeded from a FEN and normalizes clocks/en-passant", () => {
    get().enter(START)
    expect(get().active).toBe(true)
    expect(get().fen).toBe(START)
    expect(get().turn).toBe("w")
  })

  it("derives castling rights from kings and rooks on home squares", () => {
    get().clearBoard()
    get().placeSpare("wK", "e1")
    get().placeSpare("wR", "h1")
    // Only the kingside rook is home → just "K".
    expect(get().fen.split(" ")[2]).toBe("K")
  })

  it("reports no castling rights on a bare board", () => {
    get().clearBoard()
    get().placeSpare("wK", "e4")
    expect(get().fen.split(" ")[2]).toBe("-")
  })

  it("keeps a single king per colour (placing relocates)", () => {
    get().clearBoard()
    get().placeSpare("wK", "e1")
    get().placeSpare("wK", "g1")
    expect(get().game.get("e1")).toBeUndefined()
    expect(get().game.get("g1")?.type).toBe("k")
  })

  it("moves a piece already on the board", () => {
    get().clearBoard()
    get().placeSpare("wQ", "d1")
    expect(get().movePiece("d1", "d4")).toBe(true)
    expect(get().game.get("d1")).toBeUndefined()
    expect(get().game.get("d4")?.type).toBe("q")
  })

  it("refuses to move from an empty square", () => {
    get().clearBoard()
    expect(get().movePiece("a1", "a2")).toBe(false)
  })

  it("removes a piece", () => {
    get().clearBoard()
    get().placeSpare("bN", "f6")
    get().removePiece("f6")
    expect(get().game.get("f6")).toBeUndefined()
  })

  it("sets the side to move", () => {
    get().setTurn("b")
    expect(get().turn).toBe("b")
    expect(get().fen.split(" ")[1]).toBe("b")
  })

  it("loads the standard start position", () => {
    get().loadStart()
    expect(get().fen).toBe(START)
  })

  it("clears the board", () => {
    get().placeSpare("wQ", "d4")
    get().clearBoard()
    expect(get().fen).toBe("8/8/8/8/8/8/8/8 w - - 0 1")
  })

  it("flips orientation and exits", () => {
    expect(get().orientation).toBe("white")
    get().flip()
    expect(get().orientation).toBe("black")
    get().exit()
    expect(get().active).toBe(false)
  })
})
