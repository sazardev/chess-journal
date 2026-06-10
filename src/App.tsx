import { useRef, useEffect, useState } from "react"
import TitleBar from "./components/TitleBar"
import Board from "./components/Board"
import MoveHistory from "./components/MoveHistory"
import ControlBar from "./components/ControlBar"
import MoveInput from "./components/MoveInput"
import Library from "./components/Library"
import SettingsPanel from "./components/SettingsPanel"
import ShortcutsOverlay from "./components/ShortcutsOverlay"
import AboutModal from "./components/AboutModal"
import { useUpdateStore } from "./stores/useUpdateStore"
import { useKeyboard } from "./hooks/useKeyboard"
import { useAutoplay } from "./hooks/useAutoplay"
import { useAutosave } from "./hooks/useAutosave"
import { useEngine } from "./hooks/useEngine"
import { useGameAnalyzer } from "./hooks/useGameAnalyzer"
import { useGameStore } from "./stores/useGameStore"
import { useBoardStore } from "./stores/useBoardStore"
import { useLibraryStore } from "./stores/useLibraryStore"
import { useMetaStore } from "./stores/useMetaStore"
import { useConfigStore } from "./stores/useConfigStore"
import { usePersistenceStore } from "./stores/usePersistenceStore"
import { newGame, saveNow, toggleCurrentFavorite } from "./lib/session"
import type { Square } from "chess.js"

export default function App() {
  const undo = useGameStore((s) => s.undo)
  const goToStart = useGameStore((s) => s.goToStart)
  const goToEnd = useGameStore((s) => s.goToEnd)
  const goBack = useGameStore((s) => s.goBack)
  const goForward = useGameStore((s) => s.goForward)
  const flipBoard = useGameStore((s) => s.flipBoard)
  const togglePlay = useGameStore((s) => s.togglePlay)
  const toggleBookmark = useGameStore((s) => s.toggleBookmark)
  const historyIndex = useGameStore((s) => s.historyIndex)
  const goToPrevBookmark = useGameStore((s) => s.goToPrevBookmark)
  const goToNextBookmark = useGameStore((s) => s.goToNextBookmark)
  const restoreState = useGameStore((s) => s.restoreState)

  const toggleAnnotationMode = useBoardStore((s) => s.toggleAnnotationMode)
  const clearAll = useBoardStore((s) => s.clearAll)

  const configInit = useConfigStore((s) => s.init)
  const configLoaded = useConfigStore((s) => s.loaded)
  const configSetOrientation = useConfigStore((s) => s.setOrientation)
  const configSetPlaySpeed = useConfigStore((s) => s.setPlaySpeed)

  const persistenceInit = usePersistenceStore((s) => s.init)
  const persistenceReady = usePersistenceStore((s) => s.ready)
  const readAutosave = usePersistenceStore((s) => s.readAutosave)

  const loadLibrary = useLibraryStore((s) => s.loadFromStorage)

  const engine = useEngine()
  const analyzer = useGameAnalyzer()

  const [libraryOpen, setLibraryOpen] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [shortcutsOpen, setShortcutsOpen] = useState(false)
  const [aboutOpen, setAboutOpen] = useState(false)
  const [panelTab, setPanelTab] = useState<"moves" | "analysis">("moves")
  const [restored, setRestored] = useState(false)

  const moveInputRef = useRef<HTMLInputElement>(null)
  const restoredRef = useRef(false)

  useEffect(() => {
    configInit()
    persistenceInit()
    // Silent check on launch — surfaces a dot on the version chip if newer.
    useUpdateStore.getState().check(true)
  }, [])

  useEffect(() => {
    if (!persistenceReady) return
    loadLibrary()
  }, [persistenceReady])

  useEffect(() => {
    if (!configLoaded || !persistenceReady) return
    if (restoredRef.current) return
    restoredRef.current = true

    const run = async () => {
      // Apply persisted preferences first; a restored game overrides them.
      const { orientation, playSpeed } = useConfigStore.getState()
      useGameStore.setState({ orientation, playSpeed })

      try {
        const data = await readAutosave()
        if (data?.game?.fullHistory?.length) {
          restoreState(data.game)
          useMetaStore.getState().load(data.meta)

          const b = useBoardStore.getState()
          for (const a of data.board?.arrows ?? []) {
            b.addArrow(a.from as Square, a.to as Square)
          }
          for (const [sq, color] of Object.entries(data.board?.highlights ?? {})) {
            b.highlightSquare(sq as Square, color)
          }
        }
      } catch {
        /* ignore — restore is best-effort */
      }

      setRestored(true)
    }

    run()

    const unsub = useGameStore.subscribe((state, prevState) => {
      if (state.orientation !== prevState.orientation) {
        configSetOrientation(state.orientation)
      }
      if (state.playSpeed !== prevState.playSpeed) {
        configSetPlaySpeed(state.playSpeed)
      }
    })
    return unsub
  }, [configLoaded, persistenceReady])

  useAutosave(restored && persistenceReady)

  useKeyboard(
    {
      ArrowLeft: () => goBack(),
      ArrowRight: () => goForward(),
      "Ctrl+Home": () => goToStart(),
      "Ctrl+End": () => goToEnd(),
      "Ctrl+z": () => undo(),
      "Ctrl+b": () => flipBoard(),
      "Ctrl+n": () => newGame(),
      "Ctrl+s": () => saveNow(),
      "Ctrl+d": () => toggleCurrentFavorite(),
      " ": () => togglePlay(),
      "Ctrl+a": () => toggleAnnotationMode("arrow"),
      "Ctrl+m": () => toggleAnnotationMode("highlight"),
      "Ctrl+x": () => clearAll(),
      "Ctrl+i": () => moveInputRef.current?.focus(),
      "Ctrl+l": () => setLibraryOpen((v) => !v),
      "Ctrl+f": () => setLibraryOpen(true),
      "Ctrl+,": () => setSettingsOpen((v) => !v),
      "Ctrl+/": () => setShortcutsOpen((v) => !v),
      "Shift+?": () => setShortcutsOpen((v) => !v),
      "?": () => setShortcutsOpen((v) => !v),
      "Ctrl+Shift+b": () => toggleBookmark(historyIndex),
      "Ctrl+Shift+ArrowLeft": () => goToPrevBookmark(),
      "Ctrl+Shift+ArrowRight": () => goToNextBookmark(),
      "Escape": () => {
        if (aboutOpen) return setAboutOpen(false)
        if (settingsOpen) return setSettingsOpen(false)
        if (shortcutsOpen) return setShortcutsOpen(false)
        if (libraryOpen) return setLibraryOpen(false)
        useBoardStore.setState({ selectedSquare: null })
      },
    },
    [],
  )

  useAutoplay()

  const tabBtn = (active: boolean) =>
    `flex-1 font-mono text-[10px] uppercase tracking-[0.12em] py-2.5 transition-colors ${
      active ? "bg-black text-white" : "text-gray-400 hover:text-black hover:bg-gray-100"
    }`

  return (
    <div className="flex h-screen h-dvh flex-col bg-white text-black">
      <TitleBar
        onOpenSettings={() => setSettingsOpen(true)}
        onOpenShortcuts={() => setShortcutsOpen(true)}
        onOpenAbout={() => setAboutOpen(true)}
      />

      <div className="relative flex flex-1 pt-9 overflow-hidden min-h-0">
        <Library open={libraryOpen} onToggle={() => setLibraryOpen((v) => !v)} />

        {libraryOpen && (
          <div
            className="fixed inset-x-0 bottom-0 top-9 z-30 bg-black/20 lg:hidden"
            onClick={() => setLibraryOpen(false)}
          />
        )}

        <div className="flex flex-1 flex-col md:flex-row overflow-hidden min-h-0">
          {/* Board */}
          <div className="flex h-[52vh] h-[52dvh] shrink-0 items-center justify-center p-2 md:h-auto md:min-h-0 md:flex-[2] md:p-4">
            <Board engine={engine} />
          </div>

          {/* Desktop side panel */}
          <div className="hidden min-h-0 shrink-0 flex-col border-l border-gray-100 md:flex md:w-56 lg:w-64">
            <div className="min-h-0 flex-1 overflow-hidden">
              <MoveHistory engineOn={engine.enabled} />
            </div>
            <div className="shrink-0 border-t border-gray-100">
              <ControlBar engine={engine} analyzer={analyzer} />
            </div>
          </div>

          {/* Mobile / tablet bottom panel with tabs */}
          <div className="flex min-h-0 flex-1 flex-col border-t border-gray-100 md:hidden">
            <div className="flex shrink-0 border-b border-gray-100">
              <button onClick={() => setPanelTab("moves")} className={tabBtn(panelTab === "moves")}>
                Moves
              </button>
              <button onClick={() => setPanelTab("analysis")} className={tabBtn(panelTab === "analysis")}>
                Analysis
              </button>
            </div>
            {panelTab === "moves" ? (
              <div className="min-h-0 flex-1 overflow-hidden">
                <MoveHistory engineOn={engine.enabled} />
              </div>
            ) : (
              <div className="min-h-0 flex-1 overflow-y-auto">
                <ControlBar engine={engine} analyzer={analyzer} />
              </div>
            )}
          </div>
        </div>
      </div>

      <MoveInput inputRef={moveInputRef} engine={engine} />

      {settingsOpen && <SettingsPanel onClose={() => setSettingsOpen(false)} />}
      {shortcutsOpen && <ShortcutsOverlay onClose={() => setShortcutsOpen(false)} />}
      {aboutOpen && <AboutModal onClose={() => setAboutOpen(false)} />}
    </div>
  )
}
