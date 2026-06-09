import { useCallback, useMemo, useState, useEffect } from "react"
import { Chessboard, type ChessboardOptions } from "react-chessboard"
import type { Square } from "chess.js"
import { useGameStore } from "../stores/useGameStore"
import { useBoardStore } from "../stores/useBoardStore"

export default function Board() {
  const fen = useGameStore((s) => s.fen)
  const orientation = useGameStore((s) => s.orientation)
  const makeMove = useGameStore((s) => s.makeMove)

  const selectedSquare = useBoardStore((s) => s.selectedSquare)
  const selectSquare = useBoardStore((s) => s.selectSquare)
  const arrows = useBoardStore((s) => s.arrows)
  const annotationMode = useBoardStore((s) => s.annotationMode)
  const addArrow = useBoardStore((s) => s.addArrow)
  const highlights = useBoardStore((s) => s.highlights)
  const highlightSquare = useBoardStore((s) => s.highlightSquare)

  const [boardWidth, setBoardWidth] = useState(560)

  useEffect(() => {
    function resize() {
      const w = Math.min(window.innerHeight * 0.7, window.innerWidth * 0.55, 640)
      setBoardWidth(Math.max(280, w))
    }
    resize()
    window.addEventListener("resize", resize)
    return () => window.removeEventListener("resize", resize)
  }, [])

  const boardArrows = useMemo(
    () =>
      arrows.map((a) => ({
        startSquare: a.from,
        endSquare: a.to,
        color: a.color,
      })),
    [arrows],
  )

  const onPieceDrop = useCallback(
    (args: { piece: unknown; sourceSquare: string; targetSquare: string | null }) => {
      if (!args.targetSquare) return false
      return makeMove(args.sourceSquare as Square, args.targetSquare as Square)
    },
    [makeMove],
  )

  const onSquareClick = useCallback(
    (args: { piece: unknown; square: string }) => {
      const square = args.square as Square

      if (annotationMode === "highlight") {
        highlightSquare(square, "var(--text-primary)")
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
    [selectedSquare, annotationMode, makeMove, selectSquare, addArrow, highlightSquare],
  )

  const squareStyles = useMemo(() => {
    const styles: Record<string, React.CSSProperties> = {}

    for (const [square, color] of Object.entries(highlights)) {
      styles[square] = {
        backgroundColor: `${color}33`,
      }
    }

    if (selectedSquare) {
      styles[selectedSquare] = {
        ...styles[selectedSquare],
        backgroundColor: "var(--text-primary)",
        opacity: 0.35,
      }
    }

    return styles
  }, [highlights, selectedSquare])

  const options: ChessboardOptions = {
    id: "chess-mini",
    position: fen,
    boardOrientation: orientation,
    allowDragging: true,
    allowDrawingArrows: true,
    arrows: boardArrows,
    squareStyles,
    animationDurationInMs: 150,
    boardStyle: {
      borderRadius: "0",
      boxShadow: "none",
    },
    darkSquareStyle: {
      backgroundColor: "#1a1a1a",
    },
    lightSquareStyle: {
      backgroundColor: "#ebebeb",
    },
    onPieceDrop,
    onSquareClick,
  }

  return (
    <div className="flex items-center justify-center" style={{ width: boardWidth, height: boardWidth }}>
      <Chessboard options={options} />
    </div>
  )
}
