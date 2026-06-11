import { create } from "zustand"
import { Chess, type Color, type PieceSymbol, type Square } from "chess.js"

const EMPTY_FEN = "8/8/8/8/8/8/8/8 w - - 0 1"
const START_FEN = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1"

/** Castling rights implied by kings/rooks sitting on their home squares. */
function deriveCastling(game: Chess): string {
  let rights = ""
  const wk = game.get("e1")
  if (wk?.type === "k" && wk.color === "w") {
    const h1 = game.get("h1")
    const a1 = game.get("a1")
    if (h1?.type === "r" && h1.color === "w") rights += "K"
    if (a1?.type === "r" && a1.color === "w") rights += "Q"
  }
  const bk = game.get("e8")
  if (bk?.type === "k" && bk.color === "b") {
    const h8 = game.get("h8")
    const a8 = game.get("a8")
    if (h8?.type === "r" && h8.color === "b") rights += "k"
    if (a8?.type === "r" && a8.color === "b") rights += "q"
  }
  return rights || "-"
}

/** Normalise the working board + chosen side-to-move into a clean, full FEN. */
function buildFen(game: Chess, turn: Color): string {
  const placement = game.fen().split(" ")[0]
  return `${placement} ${turn} ${deriveCastling(game)} - 0 1`
}

interface EditorState {
  active: boolean
  /** skipValidation instance — holds partial / "illegal" positions while editing. */
  game: Chess
  fen: string
  orientation: "white" | "black"
  turn: Color

  enter: (fromFen?: string) => void
  exit: () => void
  /** Drop a spare piece (e.g. "wQ") onto a square. Returns false if rejected. */
  placeSpare: (pieceType: string, square: Square) => boolean
  /** Move a piece already on the board to another square. */
  movePiece: (from: Square, to: Square) => boolean
  /** Remove the piece on a square (dragging it off the board). */
  removePiece: (square: Square) => void
  setTurn: (turn: Color) => void
  clearBoard: () => void
  loadStart: () => void
  flip: () => void
}

export const useEditorStore = create<EditorState>((set, get) => {
  const game = new Chess(EMPTY_FEN, { skipValidation: true })

  const sync = () => set({ fen: buildFen(get().game, get().turn) })

  return {
    active: false,
    game,
    fen: buildFen(game, "w"),
    orientation: "white",
    turn: "w",

    enter: (fromFen) => {
      const g = new Chess(EMPTY_FEN, { skipValidation: true })
      if (fromFen) {
        try {
          g.load(fromFen, { skipValidation: true })
        } catch {
          /* fall back to the empty board */
        }
      }
      const turn = g.turn()
      set({ active: true, game: g, turn, fen: buildFen(g, turn) })
    },

    exit: () => set({ active: false }),

    placeSpare: (pieceType, square) => {
      const { game } = get()
      const color = pieceType[0] as Color
      const type = pieceType[1].toLowerCase() as PieceSymbol
      // One king per colour — placing a king relocates the existing one.
      if (type === "k") {
        for (const sq of game.findPiece({ type: "k", color })) game.remove(sq)
      }
      game.remove(square)
      const ok = game.put({ type, color }, square)
      if (ok) sync()
      return ok
    },

    movePiece: (from, to) => {
      const { game } = get()
      const piece = game.get(from)
      if (!piece) return false
      game.remove(from)
      game.remove(to)
      const ok = game.put({ type: piece.type, color: piece.color }, to)
      if (ok) sync()
      return ok
    },

    removePiece: (square) => {
      get().game.remove(square)
      sync()
    },

    setTurn: (turn) => set({ turn, fen: buildFen(get().game, turn) }),

    clearBoard: () => {
      const g = new Chess(EMPTY_FEN, { skipValidation: true })
      set({ game: g, turn: "w", fen: buildFen(g, "w") })
    },

    loadStart: () => {
      const g = new Chess(START_FEN, { skipValidation: true })
      set({ game: g, turn: "w", fen: buildFen(g, "w") })
    },

    flip: () => set({ orientation: get().orientation === "white" ? "black" : "white" }),
  }
})
