import type { Move } from "chess.js"

export interface SaveData {
  version: 1
  meta: {
    name: string
    rating: number
    tags: string[]
    notes: string
    createdAt: string
    updatedAt: string
  }
  game: {
    fullHistory: Move[]
    historyIndex: number
    orientation: "white" | "black"
    bookmarks: number[]
    comments: Record<number, string>
    isPlaying: boolean
    playSpeed: number
  }
  board: {
    arrows: { from: string; to: string; color: string }[]
    highlights: Record<string, string>
    annotationHistory: { type: string; from?: string; to?: string; square?: string }[]
  }
}

export interface SaveMeta {
  name: string
  rating: number
  tags?: string[]
  notes?: string
}
