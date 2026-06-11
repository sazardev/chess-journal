import { useCallback, useEffect, useRef, useState } from "react"
import { Chessboard, ChessboardProvider, SparePiece } from "react-chessboard"
import type { ChessboardOptions, PieceDropHandlerArgs } from "react-chessboard"
import type { Square } from "chess.js"
import { useEditorStore } from "../stores/useEditorStore"

const SURFACE = "#ffffff"
const DARK_SQUARE = "#b0b0b0"
const NOTATION = "#6b7280"

const WHITE_PIECES = ["wK", "wQ", "wR", "wB", "wN", "wP"]
const BLACK_PIECES = ["bK", "bQ", "bR", "bB", "bN", "bP"]

export default function BoardEditor() {
  const fen = useEditorStore((s) => s.fen)
  const orientation = useEditorStore((s) => s.orientation)
  const placeSpare = useEditorStore((s) => s.placeSpare)
  const movePiece = useEditorStore((s) => s.movePiece)
  const removePiece = useEditorStore((s) => s.removePiece)

  const [boardSize, setBoardSize] = useState(420)
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const el = containerRef.current?.parentElement
    if (!el) return

    const ro = new ResizeObserver(([entry]) => {
      const w = entry.contentRect.width
      const h = entry.contentRect.height
      // Leave headroom for the two spare-piece trays (top + bottom).
      const size = Math.floor(Math.min((Math.max(w, 200) * 8) / 9, (Math.max(h, 200) * 8) / 11, 600))
      setBoardSize(Math.max(180, size))
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  const cell = boardSize / 8

  const onPieceDrop = useCallback(
    ({ piece, sourceSquare, targetSquare }: PieceDropHandlerArgs) => {
      // Dropped off the board → remove (spare pieces just vanish).
      if (!targetSquare) {
        if (!piece.isSparePiece) removePiece(sourceSquare as Square)
        return true
      }
      if (piece.isSparePiece) return placeSpare(piece.pieceType, targetSquare as Square)
      return movePiece(sourceSquare as Square, targetSquare as Square)
    },
    [placeSpare, movePiece, removePiece],
  )

  const options: ChessboardOptions = {
    id: "chess-journal-editor",
    position: fen,
    boardOrientation: orientation,
    allowDragging: true,
    allowDragOffBoard: true,
    allowDrawingArrows: false,
    showNotation: true,
    animationDurationInMs: 0,
    boardStyle: {
      borderRadius: "0",
      boxShadow: "none",
    },
    darkSquareStyle: { backgroundColor: DARK_SQUARE },
    lightSquareStyle: { backgroundColor: SURFACE },
    alphaNotationStyle: { fontFamily: "var(--font-mono)", fontSize: "9px", color: NOTATION },
    numericNotationStyle: { fontFamily: "var(--font-mono)", fontSize: "9px", color: NOTATION },
    onPieceDrop,
  }

  const tray = (pieces: string[]) => (
    <div className="flex justify-center gap-0.5" style={{ width: boardSize }}>
      {pieces.map((p) => (
        <div key={p} style={{ width: cell, height: cell }} className="bg-gray-50">
          <SparePiece pieceType={p} />
        </div>
      ))}
    </div>
  )

  // Top tray holds the colour shown at the top of the board; bottom holds the near side.
  const topPieces = orientation === "white" ? BLACK_PIECES : WHITE_PIECES
  const bottomPieces = orientation === "white" ? WHITE_PIECES : BLACK_PIECES

  return (
    <div ref={containerRef} id="chess-journal-export" className="flex flex-col items-center gap-1.5">
      <ChessboardProvider options={options}>
        {tray(topPieces)}
        <div style={{ width: boardSize, height: boardSize }}>
          <Chessboard />
        </div>
        {tray(bottomPieces)}
      </ChessboardProvider>
    </div>
  )
}
