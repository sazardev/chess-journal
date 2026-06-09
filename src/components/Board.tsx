import { useCallback, useMemo, useState, useEffect, useRef } from "react"
import { Chessboard, defaultPieces, type ChessboardOptions, type PieceRenderObject } from "react-chessboard"
import type { Square } from "chess.js"
import { useGameStore } from "../stores/useGameStore"
import { useBoardStore } from "../stores/useBoardStore"
import EvalBar from "./EvalBar"
import type { useEngine } from "../hooks/useEngine"

const FILES = ["a", "b", "c", "d", "e", "f", "g", "h"]
const RANKS = ["8", "7", "6", "5", "4", "3", "2", "1"]

const SURFACE = "#ffffff"
const TEXT = "#000000"

function makePieces(darkFill: string, lightFill: string): PieceRenderObject {
  return Object.fromEntries(
    Object.entries(defaultPieces).map(([key, render]) => {
      const isWhite = key[0] === "w"
      const fill = isWhite ? lightFill : darkFill
      return [key, (props: Record<string, unknown>) => render({ ...props, fill })]
    }),
  ) as PieceRenderObject
}

export default function Board({ engine }: { engine: ReturnType<typeof useEngine> }) {
  const { eval_, enabled: engineOn, loading: engineLoading } = engine
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

  const monoPieces = useMemo(() => makePieces(TEXT, SURFACE), [])

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
        backgroundColor: TEXT,
        opacity: 0.3,
      }
    }

    return styles
  }, [highlights, selectedSquare])

  const options: ChessboardOptions = {
    id: "chess-mini",
    position: fen,
    boardOrientation: orientation,
    allowDragging: true,
    allowDrawingArrows: false,
    arrows: boardArrows,
    pieces: monoPieces,
    squareStyles,
    showNotation: false,
    animationDurationInMs: 120,
    boardStyle: {
      borderRadius: "0",
      boxShadow: "none",
    },
    darkSquareStyle: {
      backgroundColor: TEXT,
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

        {engineOn && (
          <EvalBar
            score={eval_.score}
            mate={eval_.mate}
            height={boardSize}
          />
        )}
        {engineLoading && (
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
