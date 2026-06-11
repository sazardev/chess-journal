import { useCallback, useState } from "react"
import { validateFen } from "chess.js"
import { useEditorStore } from "../stores/useEditorStore"
import { useGameStore } from "../stores/useGameStore"
import { useMetaStore } from "../stores/useMetaStore"
import { saveEditorPosition } from "../lib/session"

const advBtn =
  "font-mono text-[10px] md:text-[9px] uppercase tracking-[0.08em] px-2 py-2 md:py-1.5 transition-colors text-gray-400 hover:text-black hover:bg-gray-100"

export default function EditorPanel() {
  const fen = useEditorStore((s) => s.fen)
  const turn = useEditorStore((s) => s.turn)
  const orientation = useEditorStore((s) => s.orientation)
  const setTurn = useEditorStore((s) => s.setTurn)
  const clearBoard = useEditorStore((s) => s.clearBoard)
  const loadStart = useEditorStore((s) => s.loadStart)
  const flip = useEditorStore((s) => s.flip)
  const exit = useEditorStore((s) => s.exit)

  // The game this edit will be saved into (synergy with the open game).
  const gameName = useMetaStore((s) => s.name)
  const linkedId = useGameStore((s) => s.currentLibraryId)

  const [copied, setCopied] = useState(false)

  const validity = validateFen(fen)

  const copyFen = useCallback(async () => {
    await navigator.clipboard.writeText(fen)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }, [fen])

  const save = useCallback(() => {
    if (!validateFen(fen).ok) return
    saveEditorPosition(fen, orientation)
  }, [fen, orientation])

  const turnBtn = (side: "w" | "b") =>
    `flex-1 font-mono text-[10px] md:text-[9px] uppercase tracking-[0.1em] py-2 md:py-1.5 transition-colors ${
      turn === side ? "bg-black text-white" : "text-gray-400 hover:text-black hover:bg-gray-100"
    }`

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between px-3 py-2">
        <span className="font-mono text-[10px] uppercase tracking-[0.15em] text-gray-400">
          Editor
        </span>
        <span className="font-mono text-[8px] tabular-nums text-gray-300">
          {linkedId ? "editing" : "new"}
        </span>
      </div>

      <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto px-3 pb-3">
        <p className="font-mono text-[9px] leading-snug text-gray-400">
          Drag pieces from the trays onto the board. Drag a piece off the board to remove it.
        </p>

        {/* Side to move */}
        <div className="flex flex-col gap-1.5">
          <span className="font-mono text-[8px] uppercase tracking-[0.1em] text-gray-400">
            Side to move
          </span>
          <div className="flex gap-1.5 md:gap-1">
            <button onClick={() => setTurn("w")} className={turnBtn("w")}>
              White
            </button>
            <button onClick={() => setTurn("b")} className={turnBtn("b")}>
              Black
            </button>
          </div>
        </div>

        {/* Board setup */}
        <div className="flex flex-col gap-1.5">
          <span className="font-mono text-[8px] uppercase tracking-[0.1em] text-gray-400">
            Board
          </span>
          <div className="flex flex-wrap items-center gap-1 md:gap-0.5">
            <button onClick={loadStart} className={advBtn}>
              Start position
            </button>
            <button onClick={clearBoard} className={advBtn}>
              Clear board
            </button>
            <button onClick={flip} className={advBtn}>
              Flip
            </button>
          </div>
        </div>

        {/* Position status */}
        <div className="flex flex-col gap-1.5">
          <span className="font-mono text-[8px] uppercase tracking-[0.1em] text-gray-400">
            Position
          </span>
          <p
            className={`font-mono text-[9px] leading-snug ${
              validity.ok ? "text-gray-400" : "text-black"
            }`}
          >
            {validity.ok ? "Ready to play." : validity.error}
          </p>
          <code className="block break-all bg-gray-50 px-1.5 py-1 font-mono text-[8px] text-gray-500 select-all">
            {fen}
          </code>
        </div>

        {/* Actions */}
        <div className="flex flex-col gap-1.5">
          <button
            onClick={save}
            disabled={!validity.ok}
            className="font-mono text-[10px] md:text-[9px] uppercase tracking-[0.15em] py-2 md:py-1.5 transition-colors bg-black text-white hover:bg-gray-800 disabled:bg-gray-100 disabled:text-gray-300"
          >
            Save to game
          </button>
          <div className="flex gap-1.5 md:gap-1">
            <button onClick={copyFen} className={`flex-1 border border-gray-200 ${advBtn}`}>
              {copied ? "Copied" : "Copy FEN"}
            </button>
            <button onClick={exit} className={`flex-1 border border-gray-200 ${advBtn}`}>
              Cancel
            </button>
          </div>
        </div>

        <p className="font-mono text-[8px] leading-snug text-gray-300">
          Save stores this position into{" "}
          <span className="text-gray-400">“{gameName || "this game"}”</span> as its starting
          position, then returns to the board — play, analyze, and export as usual.
        </p>
      </div>
    </div>
  )
}
