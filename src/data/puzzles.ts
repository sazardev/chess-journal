import data from "./puzzles.json"

export type PuzzleColor = "w" | "b"
export type PuzzleDifficulty = "easy" | "medium" | "hard"

export interface Puzzle {
  id: string
  title: string
  /** Objective only (e.g. "White to move and mate in two") — never a move hint. */
  description: string
  fen: string
  /**
   * Solution in UCI. The player to move plays the even indices (0, 2, 4…); the
   * opponent's scripted replies are the odd indices. The position is already the
   * player's turn — there is no setup move to auto-play.
   */
  solution: string[]
  playerColor: PuzzleColor
  mateIn: number
  theme: string
  difficulty: PuzzleDifficulty
  rating: number
  source: string
}

export const PUZZLES: Puzzle[] = data as Puzzle[]

export const DIFFICULTY_ORDER: PuzzleDifficulty[] = ["easy", "medium", "hard"]

export const DIFFICULTY_LABEL: Record<PuzzleDifficulty, string> = {
  easy: "Easy",
  medium: "Medium",
  hard: "Hard",
}

/** Number of moves the solver actually has to find (the even-index plies). */
export function playerSteps(p: Puzzle): number {
  return Math.ceil(p.solution.length / 2)
}
