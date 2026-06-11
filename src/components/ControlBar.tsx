import { useCallback, useMemo, useRef, useState } from "react"
import { toPng } from "html-to-image"
import { type Square } from "chess.js"
import { useGameStore } from "../stores/useGameStore"
import { useBoardStore } from "../stores/useBoardStore"
import { useMetaStore } from "../stores/useMetaStore"
import { useAnalysisStore } from "../stores/useAnalysisStore"
import { useConfigStore, ENGINE_PRESETS, type EnginePresetId } from "../stores/useConfigStore"
import { buildSaveData, openEditor } from "../lib/session"
import { candidateColor } from "../lib/heatmap"
import { uciToSan, uciToSanList } from "../lib/uci"
import { saveTextFile, fileStem } from "../lib/exporters"
import type { useEngine } from "../hooks/useEngine"
import type { useGameAnalyzer } from "../hooks/useGameAnalyzer"
import MetaEditor from "./MetaEditor"

interface ControlBarProps {
  engine: ReturnType<typeof useEngine>
  analyzer: ReturnType<typeof useGameAnalyzer>
  onOpenReport: () => void
}

export default function ControlBar({ engine, analyzer, onOpenReport }: ControlBarProps) {
  const {
    eval_,
    enabled: engineOn,
    loading: engineLoading,
    toggle: toggleEngine,
    visualMode,
    toggleVisual,
    candidates,
  } = engine

  const { analyzing, done, total, run: runAnalysis, cancel: cancelAnalysis } = analyzer

  const markMode = useAnalysisStore((s) => s.markMode)
  const toggleMark = useAnalysisStore((s) => s.toggleMark)

  const openingAnalyzer = useConfigStore((s) => s.openingAnalyzer)
  const setOpeningAnalyzer = useConfigStore((s) => s.setOpeningAnalyzer)
  const enginePreset = useConfigStore((s) => s.engineConfig.preset)
  const setEnginePreset = useConfigStore((s) => s.setEnginePreset)

  const fen = useGameStore((s) => s.fen)
  const moveCount = useGameStore((s) => s.fullHistory.length)
  const flipBoard = useGameStore((s) => s.flipBoard)
  const loadPgn = useGameStore((s) => s.loadPgn)
  const getPgn = useGameStore((s) => s.getPgn)
  const getFen = useGameStore((s) => s.getFen)
  const makeMove = useGameStore((s) => s.makeMove)

  const annotationMode = useBoardStore((s) => s.annotationMode)
  const toggleAnnotationMode = useBoardStore((s) => s.toggleAnnotationMode)
  const arrows = useBoardStore((s) => s.arrows)
  const highlights = useBoardStore((s) => s.highlights)
  const undoLastAnnotation = useBoardStore((s) => s.undoLastAnnotation)
  const clearAll = useBoardStore((s) => s.clearAll)

  const [copied, setCopied] = useState("")
  const [exportState, setExportState] = useState<"idle" | "loading" | "error" | "done">("idle")
  const [exportError, setExportError] = useState("")
  const [advancedOpen, setAdvancedOpen] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const name = useMetaStore((s) => s.name)

  const sanLine = useMemo(
    () => (eval_.bestLine.length > 0 ? uciToSanList(fen, eval_.bestLine) : []),
    [fen, eval_.bestLine],
  )

  const sanCandidates = useMemo(
    () => candidates.map((c) => ({ ...c, san: uciToSan(fen, c.uci) })),
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

  const flash = useCallback((label: string) => {
    setCopied(label)
    setTimeout(() => setCopied(""), 1500)
  }, [])

  const exportPgnFile = useCallback(async () => {
    const ok = await saveTextFile(`${fileStem(name)}.pgn`, ["pgn"], "PGN", "application/x-chess-pgn", getPgn())
    if (ok) flash("PGN saved")
  }, [name, getPgn, flash])

  const exportJsonFile = useCallback(async () => {
    const json = JSON.stringify(buildSaveData(), null, 2)
    const ok = await saveTextFile(`${fileStem(name)}.json`, ["json"], "JSON", "application/json", json)
    if (ok) flash("JSON saved")
  }, [name, flash])

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

  const modeBtn = (mode: "arrow" | "highlight") =>
    `flex-1 font-mono text-[10px] md:text-[9px] uppercase tracking-[0.1em] py-2 md:py-1.5 transition-colors ${
      annotationMode === mode
        ? "bg-black text-white"
        : "text-gray-400 hover:text-black hover:bg-gray-100"
    }`

  const advBtn =
    "font-mono text-[9px] uppercase tracking-[0.08em] px-2 py-1.5 md:py-1 transition-colors text-gray-400 hover:text-black hover:bg-gray-100"

  return (
    <div className="flex flex-col px-3 pb-3 gap-2 md:gap-3">
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

      <button
        onClick={openEditor}
        className="font-mono text-[10px] md:text-[9px] uppercase tracking-[0.15em] py-2 md:py-1.5 transition-colors text-gray-400 hover:text-black hover:bg-gray-100"
      >
        Edit position
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

      {engineOn && (
        <div className="flex flex-col gap-1">
          <span className="font-mono text-[8px] uppercase tracking-[0.1em] text-gray-400">
            Preset
          </span>
          <div className="flex gap-0.5">
            {(Object.keys(ENGINE_PRESETS) as EnginePresetId[]).map((id) => (
              <button
                key={id}
                onClick={() => setEnginePreset(id)}
                className={`flex-1 font-mono text-[10px] md:text-[9px] uppercase tracking-[0.1em] py-2 md:py-1.5 transition-colors ${
                  id === enginePreset
                    ? "bg-black text-white"
                    : "text-gray-400 hover:text-black hover:bg-gray-100"
                }`}
              >
                {ENGINE_PRESETS[id].label}
              </button>
            ))}
          </div>
        </div>
      )}

      {engineOn && eval_.depth > 0 && (
        <div className="flex items-center justify-between">
          <span className="font-mono text-[8px] uppercase tracking-[0.1em] text-gray-400">
            Engine
          </span>
          <span className="font-mono text-[8px] tabular-nums text-gray-300">
            depth {eval_.depth}
          </span>
        </div>
      )}

      {engineOn && moveCount > 0 && (
        <div className="flex flex-col gap-1.5">
          <div className="flex items-center justify-between">
            <span className="font-mono text-[8px] uppercase tracking-[0.1em] text-gray-400">
              Move quality
            </span>
            <span className="font-mono text-[8px] text-gray-300">! !! ? ??</span>
          </div>
          <div className="flex gap-1.5 md:gap-1">
            <button
              onClick={toggleMark}
              className={`flex-1 font-mono text-[10px] md:text-[9px] uppercase tracking-[0.1em] py-2 md:py-1.5 transition-colors ${
                markMode
                  ? "bg-black text-white"
                  : "text-gray-400 hover:text-black hover:bg-gray-100"
              }`}
            >
              Marks {markMode ? "On" : "Off"}
            </button>
            <button
              onClick={analyzing ? cancelAnalysis : runAnalysis}
              className={`flex-1 font-mono text-[10px] md:text-[9px] uppercase tracking-[0.1em] py-2 md:py-1.5 transition-colors ${
                analyzing
                  ? "bg-black text-white"
                  : "text-gray-400 hover:text-black hover:bg-gray-100"
              }`}
            >
              {analyzing ? `Stop ${done}/${total}` : "Analyze game"}
            </button>
          </div>
          {analyzing && (
            <div className="h-0.5 w-full bg-gray-100">
              <div
                className="h-full bg-black transition-all duration-150"
                style={{ width: `${total > 0 ? (done / total) * 100 : 0}%` }}
              />
            </div>
          )}
          {markMode && !analyzing && (
            <p className="font-mono text-[8px] text-gray-300 leading-snug">
              Marks fill in as the engine sees each position — run “Analyze game” to mark the whole game.
            </p>
          )}
          <button
            onClick={onOpenReport}
            className="font-mono text-[10px] md:text-[9px] uppercase tracking-[0.15em] py-2 md:py-1.5 transition-colors text-gray-400 hover:text-black hover:bg-gray-100"
          >
            Game report
          </button>
        </div>
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
            {sanCandidates.map((c, i) => {
              const label = c.mate !== null
                ? `M${c.mate}`
                : c.score > 0
                  ? `+${(c.score / 100).toFixed(1)}`
                  : (c.score / 100).toFixed(1)

              const dot = candidateColor(candidates, c)

              return (
                <div key={c.multipv} className="flex items-center gap-1.5">
                  <span className="font-mono text-[8px] w-3 text-right tabular-nums text-gray-300">
                    {i + 1}
                  </span>
                  <span
                    className="h-1.5 w-1.5 shrink-0 rounded-full"
                    style={{ backgroundColor: dot }}
                    title="Relative to best move"
                  />
                  <span className="font-mono text-[9px] w-10 text-right tabular-nums text-gray-400">
                    {label}
                  </span>
                  <button
                    onClick={() => playChip(c.uci)}
                    className="font-mono text-[10px] px-1.5 py-1 md:py-0.5 bg-gray-100 text-black transition-colors hover:bg-black hover:text-white"
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

      <div>
        <button
          onClick={() => setAdvancedOpen((v) => !v)}
          className="flex items-center gap-1 font-mono text-[9px] uppercase tracking-[0.1em] text-gray-400 hover:text-black transition-colors py-1"
        >
          <span>{advancedOpen ? "▲" : "▼"}</span>
          Advanced
        </button>

        {advancedOpen && (
          <div className="mt-2 flex flex-col gap-3 border-t border-gray-100 pt-3">
            {/* Game metadata — rating, tags, notes (auto-saved) */}
            <MetaEditor embedded />

            {/* Detection */}
            <div className="flex items-center justify-between">
              <span className="font-mono text-[8px] uppercase tracking-[0.1em] text-gray-400">
                Opening detection
              </span>
              <button
                onClick={() => setOpeningAnalyzer(!openingAnalyzer)}
                className={`font-mono text-[9px] uppercase tracking-[0.08em] px-2 py-1 transition-colors ${
                  openingAnalyzer
                    ? "bg-black text-white"
                    : "text-gray-400 hover:text-black hover:bg-gray-100"
                }`}
              >
                {openingAnalyzer ? "On" : "Off"}
              </button>
            </div>

            {/* Annotate */}
            <div className="flex flex-col gap-1.5">
              <div className="flex items-center gap-2">
                <span className="font-mono text-[8px] uppercase tracking-[0.1em] text-gray-400">
                  Annotate
                </span>
                {totalAnnotations > 0 && (
                  <span className="font-mono text-[8px] tabular-nums text-gray-300">{totalAnnotations}</span>
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
              <p className="font-mono text-[8px] text-gray-300">
                {annotationMode === "arrow"
                  ? "Click two squares to draw"
                  : annotationMode === "highlight"
                    ? "Click a square to toggle a mark"
                    : "Pick a mode to annotate"}
              </p>
              {totalAnnotations > 0 && (
                <div className="flex gap-1.5 md:gap-1">
                  <button onClick={undoLastAnnotation} className={`flex-1 ${advBtn}`}>
                    Undo
                  </button>
                  <button onClick={clearAll} className={`flex-1 ${advBtn}`}>
                    Clear
                  </button>
                </div>
              )}
            </div>

            {/* Export / import */}
            <div className="flex flex-col gap-1.5">
              <span className="font-mono text-[8px] uppercase tracking-[0.1em] text-gray-400">
                Export / import
              </span>
              <div className="flex flex-wrap items-center gap-1 md:gap-0.5">
                <button onClick={copyFen} className={advBtn}>
                  {copied === "FEN" ? "Copied" : "Copy FEN"}
                </button>
                <button onClick={copyPgn} className={advBtn}>
                  {copied === "PGN" ? "Copied" : "Copy PGN"}
                </button>
                <button onClick={exportPgnFile} className={advBtn}>
                  {copied === "PGN saved" ? "Saved" : "PGN file"}
                </button>
                <button onClick={exportJsonFile} className={advBtn}>
                  {copied === "JSON saved" ? "Saved" : "JSON file"}
                </button>
                <button onClick={() => fileInputRef.current?.click()} className={advBtn}>
                  Import PGN
                </button>
                <button onClick={exportPng} disabled={exportState === "loading"} className={`${advBtn} disabled:opacity-30`}>
                  {exportState === "loading"
                    ? "..."
                    : exportState === "done"
                      ? "PNG saved"
                      : exportState === "error"
                        ? exportError || "PNG error"
                        : "Export PNG"}
                </button>
                <button onClick={flipBoard} className={advBtn}>
                  Flip board
                </button>
              </div>
            </div>

            <input
              ref={fileInputRef}
              type="file"
              accept=".pgn"
              onChange={handleImportPgn}
              className="hidden"
            />
          </div>
        )}
      </div>
    </div>
  )
}
