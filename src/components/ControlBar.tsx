import { useCallback, useRef, useState } from "react"
import { useGameStore } from "../stores/useGameStore"
import { useBoardStore } from "../stores/useBoardStore"

export default function ControlBar() {
  const reset = useGameStore((s) => s.reset)
  const flipBoard = useGameStore((s) => s.flipBoard)
  const loadPgn = useGameStore((s) => s.loadPgn)
  const getPgn = useGameStore((s) => s.getPgn)
  const getFen = useGameStore((s) => s.getFen)
  const orientation = useGameStore((s) => s.orientation)

  const annotationMode = useBoardStore((s) => s.annotationMode)
  const toggleAnnotationMode = useBoardStore((s) => s.toggleAnnotationMode)
  const clearArrows = useBoardStore((s) => s.clearArrows)
  const clearHighlights = useBoardStore((s) => s.clearHighlights)
  const arrows = useBoardStore((s) => s.arrows)
  const highlights = useBoardStore((s) => s.highlights)

  const [copied, setCopied] = useState("")
  const fileInputRef = useRef<HTMLInputElement>(null)

  const copyFen = useCallback(async () => {
    const fen = getFen()
    await navigator.clipboard.writeText(fen)
    setCopied("FEN")
    setTimeout(() => setCopied(""), 1500)
  }, [getFen])

  const copyPgn = useCallback(async () => {
    const pgn = getPgn()
    await navigator.clipboard.writeText(pgn)
    setCopied("PGN")
    setTimeout(() => setCopied(""), 1500)
  }, [getPgn])

  const handleImportPgn = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0]
      if (!file) return
      const reader = new FileReader()
      reader.onload = () => {
        const text = reader.result as string
        loadPgn(text)
      }
      reader.readAsText(file)
      e.target.value = ""
    },
    [loadPgn],
  )

  const baseBtn =
    "font-mono text-[9px] uppercase tracking-[0.1em] px-2 py-1 transition-colors hover:bg-text-primary hover:text-surface border border-border"

  return (
    <div className="flex flex-col gap-1 border-t border-border p-2">
      <div className="flex flex-wrap gap-1">
        <button onClick={reset} className={baseBtn} title="New game">
          New
        </button>
        <button
          onClick={flipBoard}
          className={baseBtn}
          title="Flip board"
        >
          Flip {orientation === "white" ? "○" : "●"}
        </button>
        <button
          onClick={copyFen}
          className={baseBtn}
          title="Copy FEN to clipboard"
        >
          {copied === "FEN" ? "Copied" : "FEN"}
        </button>
        <button
          onClick={copyPgn}
          className={baseBtn}
          title="Copy PGN to clipboard"
        >
          {copied === "PGN" ? "Copied" : "PGN"}
        </button>
        <button
          onClick={() => fileInputRef.current?.click()}
          className={baseBtn}
          title="Import PGN file"
        >
          Import
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept=".pgn"
          onChange={handleImportPgn}
          className="hidden"
        />
      </div>

      <div className="flex flex-wrap gap-1">
        <button
          onClick={() => toggleAnnotationMode("arrow")}
          className={`${baseBtn} ${
            annotationMode === "arrow"
              ? "bg-text-primary text-surface"
              : ""
          }`}
          title="Arrow mode: click two squares to draw an arrow"
        >
          Arrow
        </button>
        <button
          onClick={() => toggleAnnotationMode("highlight")}
          className={`${baseBtn} ${
            annotationMode === "highlight"
              ? "bg-text-primary text-surface"
              : ""
          }`}
          title="Highlight mode: click square to toggle mark"
        >
          Mark
        </button>
        {arrows.length > 0 && (
          <button
            onClick={clearArrows}
            className={baseBtn}
            title="Clear all arrows"
          >
            × Arrows
          </button>
        )}
        {Object.keys(highlights).length > 0 && (
          <button
            onClick={clearHighlights}
            className={baseBtn}
            title="Clear all marks"
          >
            × Marks
          </button>
        )}
      </div>

      <div className="flex items-center gap-2 font-mono text-[9px] text-text-secondary/50">
        <span>Arrow: click two squares</span>
        <span>Mark: click square</span>
      </div>
    </div>
  )
}
