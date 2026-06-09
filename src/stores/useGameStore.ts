import { create } from "zustand"
import { Chess, type Move, type Square } from "chess.js"

export interface GameState {
  fen: string
  history: Move[]
  historyIndex: number
  orientation: "white" | "black"
  game: Chess
  turn: "w" | "b"
  isCheck: boolean
  isCheckmate: boolean
  isDraw: boolean
  isGameOver: boolean

  makeMove: (from: Square, to: Square, promotion?: string) => boolean
  makeMoveSan: (san: string) => boolean
  undo: () => void
  goToStart: () => void
  goToEnd: () => void
  goBack: () => void
  goForward: () => void
  goToMove: (index: number) => void
  flipBoard: () => void
  reset: () => void
  loadFen: (fen: string) => void
  loadPgn: (pgn: string) => void
  getPgn: () => string
  getFen: () => string
}

function computeState(game: Chess, historyIndex: number) {
  return {
    fen: game.fen(),
    history: game.history({ verbose: true }),
    historyIndex,
    turn: game.turn(),
    isCheck: game.isCheck(),
    isCheckmate: game.isCheckmate(),
    isDraw: game.isDraw(),
    isGameOver: game.isGameOver(),
  }
}

export const useGameStore = create<GameState>((set, get) => {
  const game = new Chess()

  return {
    game,
    ...computeState(game, 0),
    orientation: "white",

    makeMove: (from, to, promotion) => {
      const { game } = get()
      try {
        const piece = game.get(from)
        if (piece && piece.type === "p") {
          const rank = to[1]
          if (
            (piece.color === "w" && rank === "8") ||
            (piece.color === "b" && rank === "1")
          ) {
            promotion = promotion || "q"
          }
        }
        const result = game.move({ from, to, promotion })
        if (!result) return false
        const idx = game.history({ verbose: true }).length
        set(computeState(game, idx))
        return true
      } catch {
        return false
      }
    },

    makeMoveSan: (san) => {
      const { game } = get()
      try {
        const result = game.move(san)
        if (!result) return false
        const idx = game.history({ verbose: true }).length
        set(computeState(game, idx))
        return true
      } catch {
        return false
      }
    },

    undo: () => {
      const { game, historyIndex } = get()
      if (historyIndex < 1) return
      game.undo()
      set(computeState(game, historyIndex - 1))
    },

    goToStart: () => {
      const { game } = get()
      while (game.history().length > 0) {
        game.undo()
      }
      set(computeState(game, 0))
    },

    goToEnd: () => {
      const { game, history } = get()
      const total = game.history({ verbose: true }).length
      if (total < history.length) {
        // Need to replay forward
        game.reset()
        for (let i = 0; i < total; i++) {
          game.move(history[i].san)
        }
      }
      set(computeState(game, total))
    },

    goBack: () => {
      const { game, historyIndex } = get()
      if (historyIndex < 1) return
      game.undo()
      set(computeState(game, historyIndex - 1))
    },

    goForward: () => {
      const { game, history, historyIndex } = get()
      if (historyIndex >= history.length) return
      const move = history[historyIndex]
      game.move(move.san)
      set(computeState(game, historyIndex + 1))
    },

    goToMove: (index) => {
      const { game, history } = get()
      game.reset()
      for (let i = 0; i < index; i++) {
        game.move(history[i].san)
      }
      set(computeState(game, index))
    },

    flipBoard: () => {
      const { orientation } = get()
      set({ orientation: orientation === "white" ? "black" : "white" })
    },

    reset: () => {
      const g = new Chess()
      set({ game: g, ...computeState(g, 0), orientation: "white" })
    },

    loadFen: (fen) => {
      const g = new Chess(fen)
      set({ game: g, ...computeState(g, 0) })
    },

    loadPgn: (pgn) => {
      const g = new Chess()
      g.loadPgn(pgn)
      const total = g.history({ verbose: true }).length
      set({ game: g, ...computeState(g, total) })
    },

    getPgn: () => {
      return get().game.pgn()
    },

    getFen: () => {
      return get().game.fen()
    },
  }
})
