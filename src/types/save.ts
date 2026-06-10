import type { Move } from "chess.js"

export type GameResult = "1-0" | "0-1" | "1/2-1/2" | "*"
export type PlayerColor = "white" | "black" | null

export interface SaveData {
  version: 1
  meta: {
    name: string
    rating: number
    tags: string[]
    notes: string
    createdAt: string
    updatedAt: string
    opening?: { eco: string; name: string; ply?: number }
    result?: GameResult
    playerColor?: PlayerColor
  }
  game: {
    fullHistory: Move[]
    historyIndex: number
    orientation: "white" | "black"
    bookmarks: number[]
    comments: Record<number, string>
    isPlaying: boolean
    playSpeed: number
    currentLibraryId: string | null
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
