import { useCallback, useMemo, useState, useEffect, useRef } from "react"
import { Chessboard, type ChessboardOptions } from "react-chessboard"
import type { Square } from "chess.js"
import { useGameStore } from "../stores/useGameStore"
import { useBoardStore } from "../stores/useBoardStore"
import { usePuzzleStore } from "../stores/usePuzzleStore"
import { useConfigStore } from "../stores/useConfigStore"
import { useAssistiveStore } from "../stores/useAssistiveStore"
import { useTouch } from "../hooks/useTouch"
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

  const assistiveMode = useConfigStore((s) => s.assistiveMode)
  const assistiveColor = useConfigStore((s) => s.assistiveColor)
  const moveBlocked =
    assistiveMode &&
    !puzzleActive &&
    fen.split(" ")[1] !== assistiveColor[0]

  const feedbackByPly = useAssistiveStore((s) => s.feedbackByPly)
  const historyIndex = useGameStore((s) => s.historyIndex)
  const historyLen = useGameStore((s) => s.fullHistory.length)

  // Gray "better move" hint for the position currently shown. The best move for a
  // ply was searched on the position *before* that move, so its squares line up
  // only on that pre-move position: when reviewing, that's `feedbackByPly[historyIndex]`
  // (the move you played from here). Live, right after you move, the board has
  // advanced one ply — fall back to the move that just led here for a ghost cue.
  const atEnd = historyIndex >= historyLen
  const hint = assistiveMode
    ? feedbackByPly[historyIndex] ?? (atEnd ? feedbackByPly[historyIndex - 1] : undefined)
    : undefined
  const showGrayHint = !!hint?.bestUci && hint.cpLoss > 30 && hint.tone !== "book"

  const selectedSquare = useBoardStore((s) => s.selectedSquare)
  const selectSquare = useBoardStore((s) => s.selectSquare)
  const arrows = useBoardStore((s) => s.arrows)
  const annotationMode = useBoardStore((s) => s.annotationMode)
  const addArrow = useBoardStore((s) => s.addArrow)
  const highlights = useBoardStore((s) => s.highlights)
  const highlightSquare = useBoardStore((s) => s.highlightSquare)

  // On touch (mobile), coordinates render inside the board so it can take the
  // full width and stay centered. Desktop keeps the external rank/file labels,
  // which reserve 1/9 of the space.
  const touch = useTouch()

  const [boardSize, setBoardSize] = useState(560)
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const el = containerRef.current?.parentElement
    if (!el) return

    const ro = new ResizeObserver(([entry]) => {
      const w = entry.contentRect.width
      const h = entry.contentRect.height
      // Mobile: full width minus the thin eval bar (when shown). Desktop: reserve
      // 1/9 for the external coordinate column/row.
      const evalReserve = showEngine ? 18 : 0
      const size = touch
        ? Math.floor(Math.min(Math.max(w - evalReserve, 200), Math.max(h, 200), 720))
        : Math.floor(Math.min((Math.max(w, 200) * 8) / 9, (Math.max(h, 200) * 8) / 9, 640))
      setBoardSize(Math.max(200, size))
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [touch, showEngine])

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

  const boardArrows = useMemo(() => {
    if (puzzleActive) return []
    const result = [
      ...arrows.map((a) => ({ startSquare: a.from, endSquare: a.to, color: a.color })),
      ...heat.arrows,
    ]
    // Gray arrow for the best alternative on the move that produced this position.
    if (showGrayHint && hint?.bestUci) {
      const from = hint.bestUci.slice(0, 2)
      const to = hint.bestUci.slice(2, 4)
      if (from.length === 2 && to.length >= 2) {
        result.push({ startSquare: from, endSquare: to, color: "rgba(140,140,140,0.72)" })
      }
    }
    return result
  }, [arrows, heat, puzzleActive, showGrayHint, hint])

  const onPieceDrop = useCallback(
    (args: { piece: unknown; sourceSquare: string; targetSquare: string | null }) => {
      if (!args.targetSquare) return false
      if (moveBlocked) return false
      if (puzzleActive) return attemptMove(args.sourceSquare as Square, args.targetSquare as Square)
      return makeMove(args.sourceSquare as Square, args.targetSquare as Square)
    },
    [makeMove, puzzleActive, attemptMove, moveBlocked],
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

      if (moveBlocked) return

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
    [selectedSquare, annotationMode, makeMove, selectSquare, addArrow, highlightSquare, puzzleActive, attemptMove, moveBlocked],
  )

  const squareStyles = useMemo(() => {
    const styles: Record<string, React.CSSProperties> = {}

    // Heatmap underlay (analyzer) — user marks and selection paint over it.
    for (const [square, style] of Object.entries(heat.squareStyles)) {
      styles[square] = { ...style }
    }

    // Gray square highlights for the best-alternative move on the shown position.
    if (showGrayHint && hint?.bestUci) {
      const from = hint.bestUci.slice(0, 2)
      const to = hint.bestUci.slice(2, 4)
      if (from.length === 2) styles[from] = { backgroundColor: "rgba(130,130,130,0.18)" }
      if (to.length >= 2)   styles[to]   = { backgroundColor: "rgba(130,130,130,0.30)" }
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
  }, [highlights, selectedSquare, heat, puzzleActive, feedback, feedbackSquare, showGrayHint, hint])

  // In-board coordinates (mobile only) — monochrome, tucked into the square
  // corners. Two colors so they read on both the white and gray squares.
  const notationFont: React.CSSProperties = {
    fontSize: Math.max(8, Math.round(boardSize / 40)),
    fontWeight: 600,
    fontFamily: "var(--font-mono)",
    userSelect: "none",
  }

  const options: ChessboardOptions = {
    id: "chess-journal",
    position: fen,
    boardOrientation: orientation,
    allowDragging: !moveBlocked,
    allowDrawingArrows: false,
    arrows: boardArrows,
    squareStyles,
    showNotation: touch,
    alphaNotationStyle: { ...notationFont, position: "absolute", bottom: 1, right: 3 },
    numericNotationStyle: { ...notationFont, position: "absolute", top: 1, left: 3 },
    lightSquareNotationStyle: { color: "#9ca3af" },
    darkSquareNotationStyle: { color: "#525252" },
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
    <div ref={containerRef} id="chess-journal-export" className="flex flex-col items-center">
      <div className="flex">
        {!touch && (
          <div className="flex flex-col">
            {ranksDisplay.map((rank) => (
              <div key={rank} style={coordStyle}>
                {rank}
              </div>
            ))}
          </div>
        )}

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

        <div style={{ width: boardSize, height: boardSize, position: "relative" }}>
          <Chessboard options={options} />
          {moveBlocked && (
            <div
              className="absolute inset-0 flex items-center justify-center pointer-events-none"
              style={{ backgroundColor: "rgba(255,255,255,0.15)" }}
            >
              <span className="font-mono text-[10px] uppercase tracking-[0.15em] text-gray-400 bg-white/80 px-3 py-1.5 rounded">
                Engine turn
              </span>
            </div>
          )}
        </div>
      </div>

      {!touch && (
        <div className="flex" style={{ paddingLeft: labelSize }}>
          {filesDisplay.map((file) => (
            <div key={file} style={coordStyle}>
              {file}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
