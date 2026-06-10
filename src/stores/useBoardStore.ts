import { create } from "zustand"
import type { Square } from "chess.js"

export interface Arrow {
  from: Square
  to: Square
  color: string
}

type Annotation =
  | { type: "arrow"; from: Square; to: Square }
  | { type: "highlight"; square: Square }

interface BoardState {
  selectedSquare: Square | null
  arrows: Arrow[]
  highlights: Record<string, string>
  annotationMode: "none" | "arrow" | "highlight"
  rightClickedSquare: Square | null
  annotationHistory: Annotation[]

  selectSquare: (square: Square | null) => void
  toggleAnnotationMode: (mode: "arrow" | "highlight") => void
  cancelAnnotation: () => void
  addArrow: (from: Square, to: Square) => void
  removeArrow: (from: Square, to: Square) => void
  clearArrows: () => void
  highlightSquare: (square: Square, color: string) => void
  clearHighlights: () => void
  undoLastAnnotation: () => void
  clearAll: () => void
}

export const useBoardStore = create<BoardState>((set, get) => ({
  selectedSquare: null,
  arrows: [],
  highlights: {},
  annotationMode: "none",
  rightClickedSquare: null,
  annotationHistory: [],

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
    const { arrows, annotationHistory } = get()
    const exists = arrows.find((a) => a.from === from && a.to === to)
    if (exists) return
    set({
      arrows: [
        ...arrows,
        { from, to, color: "#757575" },
      ],
      annotationHistory: [...annotationHistory, { type: "arrow", from, to }],
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
    const { highlights, annotationHistory } = get()
    if (highlights[square]) {
      const rest = { ...highlights }
      delete rest[square]
      set({ highlights: rest })
    } else {
      set({
        highlights: { ...highlights, [square]: color },
        annotationHistory: [...annotationHistory, { type: "highlight", square }],
      })
    }
  },

  clearHighlights: () => {
    set({ highlights: {} })
  },

  undoLastAnnotation: () => {
    const { annotationHistory, arrows, highlights } = get()
    if (annotationHistory.length === 0) return

    const last = annotationHistory[annotationHistory.length - 1]
    const rest = annotationHistory.slice(0, -1)

    if (last.type === "arrow") {
      set({
        arrows: arrows.filter(
          (a) => !(a.from === last.from && a.to === last.to),
        ),
        annotationHistory: rest,
      })
    } else {
      const remaining = { ...highlights }
      delete remaining[last.square]
      set({
        highlights: remaining,
        annotationHistory: rest,
      })
    }
  },

  clearAll: () => {
    set({
      arrows: [],
      highlights: {},
      annotationMode: "none",
      rightClickedSquare: null,
      selectedSquare: null,
      annotationHistory: [],
    })
  },
}))
