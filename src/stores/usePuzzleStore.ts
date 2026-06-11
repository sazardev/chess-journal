import { create } from "zustand"
import { Chess, type Square } from "chess.js"
import type { Puzzle } from "../data/puzzles"
import { usePuzzleProgressStore } from "./usePuzzleProgressStore"
import { soundForMove, playWrong } from "../lib/sound"

type PuzzleStatus = "playing" | "solved"
type Feedback = "none" | "right" | "wrong"

interface PuzzleState {
  active: boolean
  puzzle: Puzzle | null
  queue: Puzzle[]
  queueIndex: number
  game: Chess
  fen: string
  orientation: "white" | "black"
  /** Index into puzzle.solution of the next expected player move (always even). */
  solutionIndex: number
  status: PuzzleStatus
  mistakes: number
  /** True while the opponent's scripted reply is animating in. */
  locked: boolean
  feedback: Feedback
  feedbackSquare: Square | null
  startedAt: number
  elapsedMs: number
  hasNext: boolean

  load: (queue: Puzzle[], index: number) => void
  attemptMove: (from: Square, to: Square, promotion?: string) => boolean
  retry: () => void
  next: () => void
  exit: () => void
}

const REPLY_DELAY = 320
const FEEDBACK_MS = 600

function lastRank(to: string): boolean {
  return to[1] === "8" || to[1] === "1"
}

export const usePuzzleStore = create<PuzzleState>((set, get) => {
  let replyTimer: ReturnType<typeof setTimeout> | undefined
  let feedbackTimer: ReturnType<typeof setTimeout> | undefined

  const clearTimers = () => {
    if (replyTimer) clearTimeout(replyTimer)
    if (feedbackTimer) clearTimeout(feedbackTimer)
    replyTimer = undefined
    feedbackTimer = undefined
  }

  const flashWrong = (square: Square) => {
    set({ feedback: "wrong", feedbackSquare: square })
    if (feedbackTimer) clearTimeout(feedbackTimer)
    feedbackTimer = setTimeout(() => set({ feedback: "none", feedbackSquare: null }), FEEDBACK_MS)
  }

  const start = (queue: Puzzle[], index: number) => {
    clearTimers()
    const puzzle = queue[index]
    const game = new Chess(puzzle.fen)
    set({
      active: true,
      puzzle,
      queue,
      queueIndex: index,
      game,
      fen: game.fen(),
      orientation: puzzle.playerColor === "w" ? "white" : "black",
      solutionIndex: 0,
      status: "playing",
      mistakes: 0,
      locked: false,
      feedback: "none",
      feedbackSquare: null,
      startedAt: Date.now(),
      elapsedMs: 0,
      hasNext: index < queue.length - 1,
    })
  }

  return {
    active: false,
    puzzle: null,
    queue: [],
    queueIndex: 0,
    game: new Chess(),
    fen: "",
    orientation: "white",
    solutionIndex: 0,
    status: "playing",
    mistakes: 0,
    locked: false,
    feedback: "none",
    feedbackSquare: null,
    startedAt: 0,
    elapsedMs: 0,
    hasNext: false,

    load: (queue, index) => start(queue, index),

    attemptMove: (from, to, promotion) => {
      const { puzzle, game, status, locked, solutionIndex, mistakes } = get()
      if (!puzzle || status !== "playing" || locked) return false

      // Validate legality against the current position first.
      const probe = new Chess(game.fen())
      let usePromo = promotion
      if (!usePromo) {
        const piece = probe.get(from)
        if (piece && piece.type === "p" && lastRank(to)) usePromo = "q"
      }
      let played
      try {
        played = probe.move({ from, to, promotion: usePromo })
      } catch {
        return false // illegal move — snap back silently, not a mistake
      }
      if (!played) return false

      const expected = puzzle.solution[solutionIndex]
      const playedUci = `${played.from}${played.to}${played.promotion ?? ""}`
      const isFinalPlayerMove = solutionIndex === puzzle.solution.length - 1
      // Accept the scripted move, or — only on the final move — any mate, so
      // alternative checkmates aren't rejected.
      const correct =
        playedUci === expected || (isFinalPlayerMove && probe.isCheckmate())

      if (!correct) {
        set({ mistakes: mistakes + 1 })
        flashWrong(to)
        playWrong()
        return false
      }

      // Commit the player's move.
      const playerMove = game.move({ from, to, promotion: usePromo })
      soundForMove(playerMove)
      const nextIndex = solutionIndex + 1
      set({ fen: game.fen(), solutionIndex: nextIndex, feedback: "right", feedbackSquare: to })

      if (nextIndex >= puzzle.solution.length) {
        // Solved — the player delivered the final move.
        const elapsedMs = Date.now() - get().startedAt
        set({ status: "solved", locked: false, elapsedMs })
        void usePuzzleProgressStore.getState().record(puzzle.id, {
          mistakes: get().mistakes,
          timeMs: elapsedMs,
          steps: puzzle.mateIn,
        })
        return true
      }

      // Play the opponent's scripted reply after a short beat.
      set({ locked: true })
      if (replyTimer) clearTimeout(replyTimer)
      replyTimer = setTimeout(() => {
        const reply = puzzle.solution[nextIndex]
        const rFrom = reply.slice(0, 2) as Square
        const rTo = reply.slice(2, 4) as Square
        const rPromo = reply.length > 4 ? reply[4] : undefined
        try {
          const replyMove = game.move({ from: rFrom, to: rTo, promotion: rPromo })
          soundForMove(replyMove)
        } catch {
          /* scripted reply should always be legal */
        }
        set({
          fen: game.fen(),
          solutionIndex: nextIndex + 1,
          locked: false,
          feedback: "none",
          feedbackSquare: null,
        })
      }, REPLY_DELAY)

      return true
    },

    retry: () => {
      const { queue, queueIndex } = get()
      if (queue.length) start(queue, queueIndex)
    },

    next: () => {
      const { queue, queueIndex } = get()
      if (queueIndex < queue.length - 1) start(queue, queueIndex + 1)
    },

    exit: () => {
      clearTimers()
      set({
        active: false,
        puzzle: null,
        queue: [],
        queueIndex: 0,
        fen: "",
        status: "playing",
        feedback: "none",
        feedbackSquare: null,
        locked: false,
      })
    },
  }
})
