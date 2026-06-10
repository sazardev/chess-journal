import { create } from "zustand"
import { Chess, type Move, type Square } from "chess.js"

export interface GameState {
  fen: string
  fullHistory: Move[]
  historyIndex: number
  orientation: "white" | "black"
  game: Chess
  turn: "w" | "b"
  isCheck: boolean
  isCheckmate: boolean
  isDraw: boolean
  isGameOver: boolean
  isPlaying: boolean
  playSpeed: number
  bookmarks: number[]
  comments: Record<number, string>
  currentLibraryId: string | null

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
  restoreState: (state: {
    fullHistory: Move[]
    historyIndex: number
    orientation: "white" | "black"
    bookmarks: number[]
    comments: Record<number, string>
    isPlaying: boolean
    playSpeed: number
    currentLibraryId: string | null
  }) => void
  getPgn: () => string
  getFen: () => string
  togglePlay: () => void
  setPlaySpeed: (ms: number) => void
  toggleBookmark: (index: number) => void
  goToPrevBookmark: () => void
  goToNextBookmark: () => void
  setComment: (index: number, text: string) => void
}

function computeState(game: Chess, historyIndex: number) {
  return {
    fen: game.fen(),
    historyIndex,
    turn: game.turn(),
    isCheck: game.isCheck(),
    isCheckmate: game.isCheckmate(),
    isDraw: game.isDraw(),
    isGameOver: game.isGameOver(),
  }
}

function rebuildGame(game: Chess, fullHistory: Move[], upTo: number) {
  game.reset()
  for (let i = 0; i < upTo; i++) {
    game.move(fullHistory[i].san)
  }
}

export const useGameStore = create<GameState>((set, get) => {
  const game = new Chess()

  return {
    game,
    fullHistory: [],
    ...computeState(game, 0),
    orientation: "white",
    isPlaying: false,
    playSpeed: 500,
    bookmarks: [],
    comments: {},
    currentLibraryId: null,

    setCurrentLibraryId: (id) => set({ currentLibraryId: id }),

    makeMove: (from, to, promotion) => {
      const { game, fullHistory, historyIndex } = get()
      try {
        rebuildGame(game, fullHistory, historyIndex)

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

        const next = [...fullHistory.slice(0, historyIndex), result]
        set({ fullHistory: next, ...computeState(game, historyIndex + 1) })
        return true
      } catch {
        return false
      }
    },

    makeMoveSan: (san) => {
      const { game, fullHistory, historyIndex } = get()
      try {
        rebuildGame(game, fullHistory, historyIndex)

        const result = game.move(san)
        if (!result) return false

        const next = [...fullHistory.slice(0, historyIndex), result]
        set({ fullHistory: next, ...computeState(game, historyIndex + 1) })
        return true
      } catch {
        return false
      }
    },

    undo: () => {
      get().goBack()
    },

    goToStart: () => {
      const { game } = get()
      game.reset()
      set({ ...computeState(game, 0), isPlaying: false })
    },

    goToEnd: () => {
      const { game, fullHistory } = get()
      rebuildGame(game, fullHistory, fullHistory.length)
      set({ ...computeState(game, fullHistory.length), isPlaying: false })
    },

    goBack: () => {
      const { game, historyIndex, fullHistory } = get()
      if (historyIndex < 1) return
      rebuildGame(game, fullHistory, historyIndex - 1)
      set(computeState(game, historyIndex - 1))
    },

    goForward: () => {
      const { game, historyIndex, fullHistory } = get()
      if (historyIndex >= fullHistory.length) return
      game.move(fullHistory[historyIndex].san)
      set(computeState(game, historyIndex + 1))
    },

    goToMove: (index) => {
      const { game, fullHistory } = get()
      rebuildGame(game, fullHistory, index)
      set(computeState(game, index))
    },

    flipBoard: () => {
      const { orientation } = get()
      set({ orientation: orientation === "white" ? "black" : "white" })
    },

    reset: () => {
      const g = new Chess()
      set({
        game: g,
        fullHistory: [],
        ...computeState(g, 0),
        orientation: "white",
        isPlaying: false,
        bookmarks: [],
        comments: {},
        currentLibraryId: null,
      })
    },

    loadFen: (fen) => {
      const g = new Chess(fen)
      set({
        game: g,
        fullHistory: [],
        ...computeState(g, 0),
        bookmarks: [],
        comments: {},
        currentLibraryId: null,
      })
    },

    loadPgn: (pgn) => {
      const g = new Chess()
      g.loadPgn(pgn)
      const fullHistory = g.history({ verbose: true })
      set({
        game: g,
        fullHistory,
        ...computeState(g, fullHistory.length),
        bookmarks: [],
        comments: {},
        currentLibraryId: null,
      })
    },

    restoreState: (state) => {
      const g = new Chess()
      rebuildGame(g, state.fullHistory, state.historyIndex)
      set({
        game: g,
        fullHistory: state.fullHistory,
        ...computeState(g, state.historyIndex),
        orientation: state.orientation,
        bookmarks: state.bookmarks,
        comments: state.comments,
        isPlaying: false,
        playSpeed: state.playSpeed,
        currentLibraryId: state.currentLibraryId ?? null,
      })
    },

    getPgn: () => {
      const { game, fullHistory, comments } = get()
      const g = new Chess()
      for (let i = 0; i < fullHistory.length; i++) {
        const comment = comments[i]
        g.move(
          fullHistory[i].san,
          comment ? ({ comment } as Record<string, unknown>) : undefined,
        )
      }
      return g.pgn()
    },

    getFen: () => {
      return get().game.fen()
    },

    togglePlay: () => {
      const { isPlaying, historyIndex, fullHistory, isGameOver } = get()
      if (isGameOver) return
      const atEnd = historyIndex >= fullHistory.length
      set({ isPlaying: atEnd ? false : !isPlaying })
    },

    setPlaySpeed: (ms) => {
      set({ playSpeed: ms })
    },

    toggleBookmark: (index) => {
      const { bookmarks } = get()
      const exists = bookmarks.includes(index)
      set({
        bookmarks: exists
          ? bookmarks.filter((b) => b !== index)
          : [...bookmarks, index].sort((a, b) => a - b),
      })
    },

    goToPrevBookmark: () => {
      const { bookmarks, historyIndex } = get()
      const prev = bookmarks.filter((b) => b < historyIndex)
      if (prev.length === 0) return
      get().goToMove(Math.max(...prev))
    },

    goToNextBookmark: () => {
      const { bookmarks, historyIndex } = get()
      const next = bookmarks.filter((b) => b > historyIndex)
      if (next.length === 0) return
      get().goToMove(Math.min(...next))
    },

    setComment: (index, text) => {
      const { comments } = get()
      const trimmed = text.trim()
      if (!trimmed) {
        const next = { ...comments }
        delete next[index]
        set({ comments: next })
      } else {
        set({ comments: { ...comments, [index]: trimmed } })
      }
    },
  }
})
