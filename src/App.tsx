import { useRef } from "react"
import TitleBar from "./components/TitleBar"
import Board from "./components/Board"
import MoveHistory from "./components/MoveHistory"
import ControlBar from "./components/ControlBar"
import MoveInput from "./components/MoveInput"
import { useKeyboard } from "./hooks/useKeyboard"
import { useAutoplay } from "./hooks/useAutoplay"
import { useEngine } from "./hooks/useEngine"
import { useGameStore } from "./stores/useGameStore"
import { useBoardStore } from "./stores/useBoardStore"

export default function App() {
  const undo = useGameStore((s) => s.undo)
  const goToStart = useGameStore((s) => s.goToStart)
  const goToEnd = useGameStore((s) => s.goToEnd)
  const goBack = useGameStore((s) => s.goBack)
  const goForward = useGameStore((s) => s.goForward)
  const flipBoard = useGameStore((s) => s.flipBoard)
  const reset = useGameStore((s) => s.reset)
  const togglePlay = useGameStore((s) => s.togglePlay)
  const toggleBookmark = useGameStore((s) => s.toggleBookmark)
  const historyIndex = useGameStore((s) => s.historyIndex)
  const goToPrevBookmark = useGameStore((s) => s.goToPrevBookmark)
  const goToNextBookmark = useGameStore((s) => s.goToNextBookmark)

  const toggleAnnotationMode = useBoardStore((s) => s.toggleAnnotationMode)
  const clearAll = useBoardStore((s) => s.clearAll)

  const engine = useEngine()

  const moveInputRef = useRef<HTMLInputElement>(null)

  useKeyboard(
    {
      ArrowLeft: () => goBack(),
      ArrowRight: () => goForward(),
      "Ctrl+Home": () => goToStart(),
      "Ctrl+End": () => goToEnd(),
      "Ctrl+z": () => undo(),
      "Ctrl+b": () => flipBoard(),
      "Ctrl+n": () => reset(),
      " ": () => togglePlay(),
      "Ctrl+a": () => toggleAnnotationMode("arrow"),
      "Ctrl+m": () => toggleAnnotationMode("highlight"),
      "Ctrl+x": () => clearAll(),
      "Ctrl+i": () => moveInputRef.current?.focus(),
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

      <div className="flex flex-1 flex-col md:flex-row overflow-y-auto md:overflow-hidden pt-9">
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

      <MoveInput inputRef={moveInputRef} />
    </div>
  )
}
