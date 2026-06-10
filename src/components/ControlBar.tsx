import { useCallback, useMemo, useRef, useState } from "react"
import { toPng } from "html-to-image"
import { Chess, type Square, type Move } from "chess.js"
import { useGameStore } from "../stores/useGameStore"
import { useBoardStore } from "../stores/useBoardStore"
import { useLibraryStore } from "../stores/useLibraryStore"
import { useMetaStore } from "../stores/useMetaStore"
import type { useEngine } from "../hooks/useEngine"
import type { SaveData } from "../types/save"
import MetaEditor from "./MetaEditor"

function uciToSanList(fen: string, uciMoves: string[]): string[] {
  const g = new Chess(fen)
  return uciMoves.map((uci) => {
    const from = uci.slice(0, 2) as Square
    const to = uci.slice(2, 4) as Square
    const promotion = uci.length > 4 ? uci[4] : undefined
    try {
      const move = g.move({ from, to, promotion })
      return move ? move.san : uci
    } catch {
      return uci
    }
  })
}

export default function ControlBar({ engine }: { engine: ReturnType<typeof useEngine> }) {
  const {
    eval_,
    enabled: engineOn,
    loading: engineLoading,
    toggle: toggleEngine,
    visualMode,
    toggleVisual,
    candidates,
  } = engine

  const fen = useGameStore((s) => s.fen)
  const reset = useGameStore((s) => s.reset)
  const flipBoard = useGameStore((s) => s.flipBoard)
  const loadPgn = useGameStore((s) => s.loadPgn)
  const getPgn = useGameStore((s) => s.getPgn)
  const getFen = useGameStore((s) => s.getFen)
  const makeMove = useGameStore((s) => s.makeMove)
  const currentLibraryId = useGameStore((s) => s.currentLibraryId)
  const setCurrentLibraryId = useGameStore((s) => s.setCurrentLibraryId)

  const annotationMode = useBoardStore((s) => s.annotationMode)
  const toggleAnnotationMode = useBoardStore((s) => s.toggleAnnotationMode)
  const arrows = useBoardStore((s) => s.arrows)
  const highlights = useBoardStore((s) => s.highlights)
  const undoLastAnnotation = useBoardStore((s) => s.undoLastAnnotation)
  const clearAll = useBoardStore((s) => s.clearAll)

  const [copied, setCopied] = useState("")
  const [exportState, setExportState] = useState<"idle" | "loading" | "error" | "done">("idle")
  const [exportError, setExportError] = useState("")
  const [editing, setEditing] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const sanLine = useMemo(
    () => (eval_.bestLine.length > 0 ? uciToSanList(fen, eval_.bestLine) : []),
    [fen, eval_.bestLine],
  )

  const sanCandidates = useMemo(
    () =>
      candidates.map((c) => ({
        ...c,
        san: (() => {
          try {
            const g = new Chess(fen)
            const from = c.uci.slice(0, 2) as Square
            const to = c.uci.slice(2, 4) as Square
            const prom = c.uci.length > 4 ? c.uci[4] : undefined
            const m = g.move({ from, to, promotion: prom })
            return m ? m.san : c.uci
          } catch {
            return c.uci
          }
        })(),
      })),
    [fen, candidates],
  )

  const copyFen = useCallback(async () => {
    await navigator.clipboard.writeText(getFen())
    setCopied("FEN")
    setTimeout(() => setCopied(""), 1500)
  }, [getFen])

  const copyPgn = useCallback(async () => {
    await navigator.clipboard.writeText(getPgn())
    setCopied("PGN")
    setTimeout(() => setCopied(""), 1500)
  }, [getPgn])

  const handleImportPgn = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0]
      if (!file) return
      const reader = new FileReader()
      reader.onload = () => loadPgn(reader.result as string)
      reader.readAsText(file)
      e.target.value = ""
    },
    [loadPgn],
  )

  const buildSaveData = useCallback((): SaveData => {
    const g = useGameStore.getState()
    const b = useBoardStore.getState()
    const meta = useMetaStore.getState().snapshot()

    return {
      version: 1,
      meta,
      game: {
        fullHistory: g.fullHistory,
        historyIndex: g.historyIndex,
        orientation: g.orientation,
        bookmarks: g.bookmarks,
        comments: g.comments,
        isPlaying: g.isPlaying,
        playSpeed: g.playSpeed,
        currentLibraryId: g.currentLibraryId,
      },
      board: {
        arrows: b.arrows.map((a) => ({ from: a.from, to: a.to, color: a.color })),
        highlights: { ...b.highlights },
        annotationHistory: b.annotationHistory.map((a) =>
          a.type === "arrow"
            ? { type: "arrow" as const, from: a.from, to: a.to }
            : { type: "highlight" as const, square: a.square },
        ),
      },
    }
  }, [])

  const handleNew = useCallback(() => {
    const g = useGameStore.getState()
    if (g.fullHistory.length > 0) {
      const id = g.currentLibraryId
      useLibraryStore.getState().addEntry(buildSaveData(), id ?? undefined)
    }
    useMetaStore.getState().reset()
    reset()
  }, [reset, buildSaveData])

  const handleSaveToLibrary = useCallback(async () => {
    const id = useGameStore.getState().currentLibraryId
    const data = buildSaveData()
    const savedId = await useLibraryStore.getState().addEntry(data, id ?? undefined)
    if (!id) useGameStore.setState({ currentLibraryId: savedId })
  }, [buildSaveData])

  const handleMetaSave = useCallback(() => {
    handleSaveToLibrary()
  }, [handleSaveToLibrary])

  const exportPng = useCallback(async () => {
    const el = document.getElementById("chess-mini-export")
    if (!el) return

    setExportState("loading")
    setExportError("")

    try {
      const dataUrl = await toPng(el, { pixelRatio: 2 })

      try {
        const { save: saveDialog } = await import("@tauri-apps/plugin-dialog")
        const { writeFile: writeFs } = await import("@tauri-apps/plugin-fs")

        const base64 = dataUrl.replace(/^data:image\/png;base64,/, "")
        const bytes = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0))

        const path = await saveDialog({
          defaultPath: "chess-mini.png",
          filters: [{ name: "PNG Image", extensions: ["png"] }],
        })
        if (!path) {
          setExportState("idle")
          return
        }

        await writeFs(path, bytes)
      } catch {
        const link = document.createElement("a")
        link.download = "chess-mini.png"
        link.href = dataUrl
        link.click()
      }

      setExportState("done")
      setTimeout(() => setExportState("idle"), 1500)
    } catch (err) {
      console.error("Export PNG failed:", err)
      setExportError(err instanceof Error ? err.message : "Export failed")
      setExportState("error")
      setTimeout(() => {
        setExportState("idle")
        setExportError("")
      }, 3000)
    }
  }, [])

  const playChip = useCallback(
    (uci: string) => {
      const from = uci.slice(0, 2) as Square
      const to = uci.slice(2, 4) as Square
      const promotion = uci.length > 4 ? uci[4] : undefined
      makeMove(from, to, promotion)
    },
    [makeMove],
  )

  const totalAnnotations = arrows.length + Object.keys(highlights).length

  const btn =
    "font-mono text-[9px] md:text-[9px] uppercase tracking-[0.08em] px-2 py-1.5 md:py-1 transition-colors text-gray-400 hover:text-black hover:bg-gray-100"

  const modeBtn = (mode: "arrow" | "highlight") =>
    `flex-1 font-mono text-[10px] md:text-[9px] uppercase tracking-[0.1em] py-2 md:py-1.5 transition-colors ${
      annotationMode === mode
        ? "bg-black text-white"
        : "text-gray-400 hover:text-black hover:bg-gray-100"
    }`

  return (
    <div className="flex flex-col px-3 md:px-3 pb-3 gap-2 md:gap-3">
      <div className="flex flex-wrap items-center gap-1 md:gap-0.5">
        <button onClick={handleNew} className={btn}>New</button>
        <button onClick={flipBoard} className={btn}>Flip</button>
        <button onClick={copyFen} className={btn}>
          {copied === "FEN" ? "Copied" : "FEN"}
        </button>
        <button onClick={copyPgn} className={btn}>
          {copied === "PGN" ? "Copied" : "PGN"}
        </button>
        <button onClick={() => fileInputRef.current?.click()} className={btn}>PGN</button>
        <button onClick={handleSaveToLibrary} className={btn}>Save</button>
        <button onClick={() => setEditing((v) => !v)} className={`${btn} ${editing ? "bg-black text-white" : ""}`}>
          Edit
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept=".pgn"
          onChange={handleImportPgn}
          className="hidden"
        />
      </div>

      {editing ? (
        <MetaEditor onSave={handleMetaSave} onClose={() => setEditing(false)} />
      ) : (
        <>
          <div className="flex flex-col gap-1.5 md:gap-2">
        <div className="flex items-center gap-2">
          <span className="font-mono text-[10px] md:text-[9px] uppercase tracking-[0.15em] text-gray-400">
            Annotations
          </span>
          {totalAnnotations > 0 && (
            <span className="font-mono text-[10px] md:text-[9px] tabular-nums text-gray-300">
              {totalAnnotations}
            </span>
          )}
        </div>

        <div className="flex gap-1.5 md:gap-1">
          <button onClick={() => toggleAnnotationMode("arrow")} className={modeBtn("arrow")}>
            Arrow
          </button>
          <button onClick={() => toggleAnnotationMode("highlight")} className={modeBtn("highlight")}>
            Mark
          </button>
        </div>

        <p className="font-mono text-[9px] md:text-[8px] text-gray-300">
          {annotationMode === "arrow"
            ? "Click two squares to draw"
            : annotationMode === "highlight"
              ? "Click square to toggle mark"
              : "Select mode to annotate"}
        </p>

        {totalAnnotations > 0 && (
          <div className="flex gap-1.5 md:gap-1">
            <button
              onClick={undoLastAnnotation}
              className="flex-1 font-mono text-[10px] md:text-[9px] uppercase tracking-[0.08em] px-2 py-1.5 md:py-1 text-gray-400 hover:text-black hover:bg-gray-100 transition-colors"
            >
              Undo
            </button>
            <button
              onClick={clearAll}
              className="flex-1 font-mono text-[10px] md:text-[9px] uppercase tracking-[0.08em] px-2 py-1.5 md:py-1 text-gray-400 hover:text-black hover:bg-gray-100 transition-colors"
            >
              Clear
            </button>
          </div>
        )}
      </div>

      <button
        onClick={toggleEngine}
        className={`font-mono text-[10px] md:text-[9px] uppercase tracking-[0.15em] py-2 md:py-1.5 transition-colors ${
          engineOn
            ? "bg-black text-white"
            : "text-gray-400 hover:text-black hover:bg-gray-100"
        }`}
      >
        {engineLoading ? "Loading..." : engineOn ? "Analyze On" : "Analyze Off"}
      </button>

      {engineOn && (
        <button
          onClick={toggleVisual}
          className={`font-mono text-[10px] md:text-[9px] uppercase tracking-[0.15em] py-2 md:py-1.5 transition-colors ${
            visualMode
              ? "bg-black text-white"
              : "text-gray-400 hover:text-black hover:bg-gray-100"
          }`}
        >
          Visual {visualMode ? "On" : "Off"}
        </button>
      )}

      {engineOn && sanLine.length > 0 && (
        <div className="flex flex-col gap-1">
          <span className="font-mono text-[8px] uppercase tracking-[0.1em] text-gray-400">
            Best line
          </span>
          <div className="flex flex-wrap gap-0.5">
            {sanLine.map((san, i) => (
              <button
                key={`${san}-${i}`}
                onClick={() => playChip(eval_.bestLine[i])}
                className="font-mono text-[10px] px-1 py-0.5 bg-gray-100 hover:bg-black hover:text-white transition-colors"
                title="Tap to play"
              >
                {san}
              </button>
            ))}
          </div>
        </div>
      )}

      {engineOn && visualMode && sanCandidates.length > 0 && (
        <div className="flex flex-col gap-1">
          <span className="font-mono text-[8px] uppercase tracking-[0.1em] text-gray-400">
            Candidates
          </span>
          <div className="flex flex-col gap-0.5">
            {sanCandidates.map((c) => {
              const label = c.mate !== null
                ? `M${c.mate}`
                : c.score > 0
                  ? `+${(c.score / 100).toFixed(1)}`
                  : (c.score / 100).toFixed(1)

              const chipStyle = c.mate !== null
                ? "bg-gray-100 text-black"
                : c.score > 50
                  ? "bg-gray-200 text-black font-semibold"
                  : c.score < -50
                    ? "bg-gray-50 text-gray-400"
                    : "bg-gray-100 text-gray-400"

              return (
                <div key={c.multipv} className="flex items-center gap-1.5">
                  <span className="font-mono text-[9px] w-10 text-right tabular-nums text-gray-400">
                    {label}
                  </span>
                  <button
                    onClick={() => playChip(c.uci)}
                    className={`font-mono text-[10px] px-1 py-0.5 transition-colors hover:bg-black hover:text-white ${chipStyle}`}
                    title="Tap to play"
                  >
                    {c.san}
                  </button>
                </div>
              )
            })}
          </div>
        </div>
      )}
        </>
      )}

      <button
        onClick={exportPng}
        disabled={exportState === "loading"}
        className={`font-mono text-[10px] md:text-[9px] uppercase tracking-[0.15em] py-2 md:py-1.5 transition-colors disabled:opacity-30 ${
          exportState === "error"
            ? "text-gray-400"
            : "text-gray-400 hover:text-black hover:bg-gray-100"
        }`}
      >
        {exportState === "loading"
          ? "..."
          : exportState === "done"
            ? "Saved"
            : exportState === "error"
              ? exportError || "Error"
              : "Export PNG"}
      </button>
    </div>
  )
}
