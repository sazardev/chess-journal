import { useCallback, useRef, useState } from "react"
import { toPng } from "html-to-image"
import { useGameStore } from "../stores/useGameStore"
import { useBoardStore } from "../stores/useBoardStore"
import type { useEngine } from "../hooks/useEngine"

export default function ControlBar({ engine }: { engine: ReturnType<typeof useEngine> }) {
  const { eval_, enabled: engineOn, loading: engineLoading, toggle: toggleEngine } = engine
  const reset = useGameStore((s) => s.reset)
  const flipBoard = useGameStore((s) => s.flipBoard)
  const loadPgn = useGameStore((s) => s.loadPgn)
  const getPgn = useGameStore((s) => s.getPgn)
  const getFen = useGameStore((s) => s.getFen)

  const annotationMode = useBoardStore((s) => s.annotationMode)
  const toggleAnnotationMode = useBoardStore((s) => s.toggleAnnotationMode)
  const arrows = useBoardStore((s) => s.arrows)
  const highlights = useBoardStore((s) => s.highlights)
  const undoLastAnnotation = useBoardStore((s) => s.undoLastAnnotation)
  const clearAll = useBoardStore((s) => s.clearAll)

  const [copied, setCopied] = useState("")
  const [exportState, setExportState] = useState<"idle" | "loading" | "error" | "done">("idle")
  const [exportError, setExportError] = useState("")
  const fileInputRef = useRef<HTMLInputElement>(null)

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
        <button onClick={reset} className={btn}>New</button>
        <button onClick={flipBoard} className={btn}>Flip</button>
        <button onClick={copyFen} className={btn}>
          {copied === "FEN" ? "Copied" : "FEN"}
        </button>
        <button onClick={copyPgn} className={btn}>
          {copied === "PGN" ? "Copied" : "PGN"}
        </button>
        <button onClick={() => fileInputRef.current?.click()} className={btn}>Import</button>
        <input
          ref={fileInputRef}
          type="file"
          accept=".pgn"
          onChange={handleImportPgn}
          className="hidden"
        />
      </div>

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

      {engineOn && eval_.depth > 0 && eval_.bestLine.length > 0 && (
        <p className="font-mono text-[9px] leading-snug text-gray-400">
          {eval_.bestLine.join(" ")}
        </p>
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
