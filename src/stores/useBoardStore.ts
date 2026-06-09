import { create } from "zustand"
import type { Square } from "chess.js"

export interface Arrow {
  from: Square
  to: Square
  color: string
}

interface BoardState {
  selectedSquare: Square | null
  arrows: Arrow[]
  highlights: Record<string, string>
  annotationMode: "none" | "arrow" | "highlight"
  rightClickedSquare: Square | null

  selectSquare: (square: Square | null) => void
  toggleAnnotationMode: (mode: "arrow" | "highlight") => void
  cancelAnnotation: () => void
  addArrow: (from: Square, to: Square) => void
  removeArrow: (from: Square, to: Square) => void
  clearArrows: () => void
  highlightSquare: (square: Square, color: string) => void
  clearHighlights: () => void
  clearAll: () => void
}

export const useBoardStore = create<BoardState>((set, get) => ({
  selectedSquare: null,
  arrows: [],
  highlights: {},
  annotationMode: "none",
  rightClickedSquare: null,

  selectSquare: (square) => {
    set({ selectedSquare: square })
  },

  toggleAnnotationMode: (mode) => {
    const { annotationMode } = get()
    set({
      annotationMode: annotationMode === mode ? "none" : mode,
      rightClickedSquare: null,
    })
  },

  cancelAnnotation: () => {
    set({ annotationMode: "none", rightClickedSquare: null })
  },

  addArrow: (from, to) => {
    const { arrows } = get()
    const exists = arrows.find((a) => a.from === from && a.to === to)
    if (exists) return
    set({
      arrows: [
        ...arrows,
        { from, to, color: "var(--text-primary)" },
      ],
    })
  },

  removeArrow: (from, to) => {
    const { arrows } = get()
    set({ arrows: arrows.filter((a) => !(a.from === from && a.to === to)) })
  },

  clearArrows: () => {
    set({ arrows: [] })
  },

  highlightSquare: (square, color) => {
    const { highlights } = get()
    if (highlights[square]) {
      const { [square]: _, ...rest } = highlights
      set({ highlights: rest })
    } else {
      set({ highlights: { ...highlights, [square]: color } })
    }
  },

  clearHighlights: () => {
    set({ highlights: {} })
  },

  clearAll: () => {
    set({
      arrows: [],
      highlights: {},
      annotationMode: "none",
      rightClickedSquare: null,
      selectedSquare: null,
    })
  },
}))
