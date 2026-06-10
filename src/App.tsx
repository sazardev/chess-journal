import { useRef, useEffect, useState, useCallback } from "react"
import TitleBar from "./components/TitleBar"
import Board from "./components/Board"
import MoveHistory from "./components/MoveHistory"
import ControlBar from "./components/ControlBar"
import MoveInput from "./components/MoveInput"
import Library from "./components/Library"
import { useKeyboard } from "./hooks/useKeyboard"
import { useAutoplay } from "./hooks/useAutoplay"
import { useEngine } from "./hooks/useEngine"
import { useGameStore } from "./stores/useGameStore"
import { useBoardStore } from "./stores/useBoardStore"
import { useLibraryStore } from "./stores/useLibraryStore"
import { useMetaStore } from "./stores/useMetaStore"
import { useConfigStore } from "./stores/useConfigStore"
import { usePersistenceStore } from "./stores/usePersistenceStore"
import type { SaveData } from "./types/save"
import type { Square } from "chess.js"

export default function App() {
  const undo = useGameStore((s) => s.undo)
  const goToStart = useGameStore((s) => s.goToStart)
  const goToEnd = useGameStore((s) => s.goToEnd)
  const goBack = useGameStore((s) => s.goBack)
  const goForward = useGameStore((s) => s.goForward)
  const flipBoard = useGameStore((s) => s.flipBoard)
  const reset = useGameStore((s) => s.reset)
  const newGame = useCallback(() => {
    const g = useGameStore.getState()
    if (g.fullHistory.length > 0) {
      const b = useBoardStore.getState()
      const meta = useMetaStore.getState().snapshot()
      const data: SaveData = {
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
          annotationHistory: [],
        },
      }
      useLibraryStore.getState().addEntry(data)
    }
    useMetaStore.getState().reset()
    reset()
  }, [reset])
  const togglePlay = useGameStore((s) => s.togglePlay)
  const toggleBookmark = useGameStore((s) => s.toggleBookmark)
  const historyIndex = useGameStore((s) => s.historyIndex)
  const fullHistory = useGameStore((s) => s.fullHistory)
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
  const writeAutosave = usePersistenceStore((s) => s.writeAutosave)

  const engine = useEngine()

  const [libraryOpen, setLibraryOpen] = useState(false)

  const loadLibrary = useLibraryStore((s) => s.loadFromStorage)

  const moveInputRef = useRef<HTMLInputElement>(null)
  const restoredRef = useRef(false)
  const saveTimerRef = useRef<ReturnType<typeof setTimeout>>()

  useEffect(() => {
    configInit()
    persistenceInit()
  }, [])

  useEffect(() => {
    if (!persistenceReady) return
    loadLibrary()
  }, [persistenceReady])

  useEffect(() => {
    if (!configLoaded || !persistenceReady) return

    const restore = async () => {
      if (restoredRef.current) return
      restoredRef.current = true

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
      } catch {}
    }

    restore()

    const { orientation, playSpeed } = useConfigStore.getState()
    useGameStore.setState({ orientation, playSpeed })

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

  useEffect(() => {
    if (!restoredRef.current) return

    if (saveTimerRef.current) clearTimeout(saveTimerRef.current)

    saveTimerRef.current = setTimeout(() => {
      const g = useGameStore.getState()
      const b = useBoardStore.getState()
      const meta = useMetaStore.getState().snapshot()

      const data: SaveData = {
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
          annotationHistory: [],
        },
      }

      writeAutosave(data)
    }, 500)

    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
    }
  }, [fullHistory, historyIndex])

  useKeyboard(
    {
      ArrowLeft: () => goBack(),
      ArrowRight: () => goForward(),
      "Ctrl+Home": () => goToStart(),
      "Ctrl+End": () => goToEnd(),
      "Ctrl+z": () => undo(),
      "Ctrl+b": () => flipBoard(),
      "Ctrl+n": () => newGame(),
      " ": () => togglePlay(),
      "Ctrl+a": () => toggleAnnotationMode("arrow"),
      "Ctrl+m": () => toggleAnnotationMode("highlight"),
      "Ctrl+x": () => clearAll(),
      "Ctrl+i": () => moveInputRef.current?.focus(),
      "Ctrl+l": () => setLibraryOpen((v) => !v),
      "Ctrl+Shift+b": () => toggleBookmark(historyIndex),
      "Ctrl+Shift+ArrowLeft": () => goToPrevBookmark(),
      "Ctrl+Shift+ArrowRight": () => goToNextBookmark(),
      "Escape": () => {
        useBoardStore.setState({ selectedSquare: null })
      },
    },
    [],
  )

  useAutoplay()

  return (
    <div className="flex h-screen h-dvh flex-col bg-white text-black">
      <TitleBar />

      <div className="flex flex-1 pt-9 overflow-hidden">
        <Library open={libraryOpen} onToggle={() => setLibraryOpen((v) => !v)} />

        <div className="flex flex-1 flex-col md:flex-row overflow-y-auto md:overflow-hidden">
          <div className="flex min-h-[55vh] min-h-[55dvh] md:min-h-0 md:flex-[2] items-center justify-center p-2 md:p-4">
            <Board engine={engine} />
          </div>

          <div className="flex shrink-0 flex-col md:w-56 lg:w-64 md:max-h-full">
            <div className="flex-1 overflow-hidden">
              <MoveHistory />
            </div>
            <div className="shrink-0">
              <ControlBar engine={engine} />
            </div>
          </div>
        </div>
      </div>

      <MoveInput inputRef={moveInputRef} />
    </div>
  )
}
