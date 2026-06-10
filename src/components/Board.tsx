import { useCallback, useMemo, useState, useEffect, useRef } from "react"
import { Chessboard, type ChessboardOptions } from "react-chessboard"
import type { Square } from "chess.js"
import { useGameStore } from "../stores/useGameStore"
import { useBoardStore } from "../stores/useBoardStore"
import { usePuzzleStore } from "../stores/usePuzzleStore"
import EvalBar from "./EvalBar"
import { computeHeatmap } from "../lib/heatmap"
import type { useEngine } from "../hooks/useEngine"

const FILES = ["a", "b", "c", "d", "e", "f", "g", "h"]
const RANKS = ["8", "7", "6", "5", "4", "3", "2", "1"]

const SURFACE = "#ffffff"
const TEXT = "#000000"
const DARK_SQUARE = "#b0b0b0"

export default function Board({ engine }: { engine: ReturnType<typeof useEngine> }) {
  const { eval_, enabled: engineOn, loading: engineLoading, visualMode, candidates } = engine
  const gameFen = useGameStore((s) => s.fen)
  const gameOrientation = useGameStore((s) => s.orientation)
  const makeMove = useGameStore((s) => s.makeMove)

  // Puzzle mode reuses this board but drives its own position and move handler.
  const puzzleActive = usePuzzleStore((s) => s.active)
  const puzzleFen = usePuzzleStore((s) => s.fen)
  const puzzleOrientation = usePuzzleStore((s) => s.orientation)
  const attemptMove = usePuzzleStore((s) => s.attemptMove)
  const feedback = usePuzzleStore((s) => s.feedback)
  const feedbackSquare = usePuzzleStore((s) => s.feedbackSquare)

  const fen = puzzleActive ? puzzleFen : gameFen
  const orientation = puzzleActive ? puzzleOrientation : gameOrientation
  const showEngine = engineOn && !puzzleActive

  const selectedSquare = useBoardStore((s) => s.selectedSquare)
  const selectSquare = useBoardStore((s) => s.selectSquare)
  const arrows = useBoardStore((s) => s.arrows)
  const annotationMode = useBoardStore((s) => s.annotationMode)
  const addArrow = useBoardStore((s) => s.addArrow)
  const highlights = useBoardStore((s) => s.highlights)
  const highlightSquare = useBoardStore((s) => s.highlightSquare)

  const [boardSize, setBoardSize] = useState(560)
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const el = containerRef.current?.parentElement
    if (!el) return

    const ro = new ResizeObserver(([entry]) => {
      const w = entry.contentRect.width
      const h = entry.contentRect.height
      const size = Math.floor(Math.min((Math.max(w, 200) * 8) / 9, (Math.max(h, 200) * 8) / 9, 640))
      setBoardSize(Math.max(200, size))
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  const labelSize = boardSize / 8
  const coordStyle: React.CSSProperties = {
    width: labelSize,
    height: labelSize,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontFamily: "var(--font-mono)",
    fontSize: Math.max(9, labelSize * 0.2),
    fontWeight: 500,
    color: "#a3a3a3",
    userSelect: "none",
  }

  const filesDisplay = orientation === "white" ? FILES : [...FILES].reverse()
  const ranksDisplay = orientation === "white" ? RANKS : [...RANKS].reverse()

  const heat = useMemo(
    () =>
      visualMode && candidates.length > 0 && !puzzleActive
        ? computeHeatmap(candidates)
        : { squareStyles: {}, arrows: [] },
    [visualMode, candidates, puzzleActive],
  )

  const boardArrows = useMemo(
    () =>
      puzzleActive
        ? []
        : [
            ...arrows.map((a) => ({
              startSquare: a.from,
              endSquare: a.to,
              color: a.color,
            })),
            ...heat.arrows,
          ],
    [arrows, heat, puzzleActive],
  )

  const onPieceDrop = useCallback(
    (args: { piece: unknown; sourceSquare: string; targetSquare: string | null }) => {
      if (!args.targetSquare) return false
      if (puzzleActive) return attemptMove(args.sourceSquare as Square, args.targetSquare as Square)
      return makeMove(args.sourceSquare as Square, args.targetSquare as Square)
    },
    [makeMove, puzzleActive, attemptMove],
  )

  const onSquareClick = useCallback(
    (args: { piece: unknown; square: string }) => {
      const square = args.square as Square

      if (puzzleActive) {
        if (!selectedSquare) {
          selectSquare(square)
        } else {
          const moved = attemptMove(selectedSquare, square)
          selectSquare(moved ? null : square)
        }
        return
      }

      if (annotationMode === "highlight") {
        highlightSquare(square, TEXT)
        return
      }
      if (annotationMode === "arrow") {
        if (!selectedSquare) {
          selectSquare(square)
        } else {
          addArrow(selectedSquare, square)
          selectSquare(null)
        }
        return
      }

      if (!selectedSquare) {
        selectSquare(square)
      } else {
        const moved = makeMove(selectedSquare, square)
        if (!moved) {
          selectSquare(square)
        } else {
          selectSquare(null)
        }
      }
    },
    [selectedSquare, annotationMode, makeMove, selectSquare, addArrow, highlightSquare, puzzleActive, attemptMove],
  )

  const squareStyles = useMemo(() => {
    const styles: Record<string, React.CSSProperties> = {}

    // Heatmap underlay (analyzer) — user marks and selection paint over it.
    for (const [square, style] of Object.entries(heat.squareStyles)) {
      styles[square] = { ...style }
    }

    // User annotations don't belong to a puzzle position.
    if (!puzzleActive) {
      for (const [square, color] of Object.entries(highlights)) {
        styles[square] = {
          backgroundColor: `${color}33`,
        }
      }
    }

    if (selectedSquare) {
      styles[selectedSquare] = {
        ...styles[selectedSquare],
        backgroundColor: "rgba(0, 0, 0, 0.3)",
      }
    }

    // Puzzle move feedback: red on a wrong attempt, dark on a correct one.
    if (puzzleActive && feedbackSquare && feedback !== "none") {
      styles[feedbackSquare] = {
        ...styles[feedbackSquare],
        backgroundColor: feedback === "wrong" ? "rgba(220, 38, 38, 0.45)" : "rgba(0, 0, 0, 0.22)",
      }
    }

    return styles
  }, [highlights, selectedSquare, heat, puzzleActive, feedback, feedbackSquare])

  const options: ChessboardOptions = {
    id: "chess-mini",
    position: fen,
    boardOrientation: orientation,
    allowDragging: true,
    allowDrawingArrows: false,
    arrows: boardArrows,
    squareStyles,
    showNotation: false,
    animationDurationInMs: 120,
    boardStyle: {
      borderRadius: "0",
      boxShadow: "none",
    },
    darkSquareStyle: {
      backgroundColor: DARK_SQUARE,
    },
    lightSquareStyle: {
      backgroundColor: SURFACE,
    },
    onPieceDrop,
    onSquareClick,
  }

  return (
    <div ref={containerRef} id="chess-mini-export" className="flex flex-col items-center">
      <div className="flex">
        <div className="flex flex-col">
          {ranksDisplay.map((rank) => (
            <div key={rank} style={coordStyle}>
              {rank}
            </div>
          ))}
        </div>

        {showEngine && (
          <EvalBar
            score={eval_.score}
            mate={eval_.mate}
            height={boardSize}
          />
        )}
        {showEngine && engineLoading && (
          <div className="w-2 shrink-0 flex items-center justify-center" style={{ height: boardSize }}>
            <div className="w-1 h-1 rounded-full bg-gray-300 animate-pulse" />
          </div>
        )}

        <div style={{ width: boardSize, height: boardSize }}>
          <Chessboard options={options} />
        </div>
      </div>

      <div className="flex" style={{ paddingLeft: labelSize }}>
        {filesDisplay.map((file) => (
          <div key={file} style={coordStyle}>
            {file}
          </div>
        ))}
      </div>
    </div>
  )
}
