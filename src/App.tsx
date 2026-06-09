import { useThemeStore } from "./stores/useThemeStore"
import { useCallback, useEffect } from "react"
import TitleBar from "./components/TitleBar"
import Board from "./components/Board"
import MoveHistory from "./components/MoveHistory"
import ControlBar from "./components/ControlBar"
import MoveInput from "./components/MoveInput"
import { useGameStore } from "./stores/useGameStore"

export default function App() {
  const theme = useThemeStore((s) => s.theme)
  const toggle = useThemeStore((s) => s.toggle)
  const undo = useGameStore((s) => s.undo)

  useEffect(() => {
    document.documentElement.classList.toggle("dark", theme === "dark")
  }, [theme])

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (((e.ctrlKey || e.metaKey) && e.key === "t")) {
        e.preventDefault()
        toggle()
        return
      }
      if (((e.ctrlKey || e.metaKey) && e.key === "z")) {
        e.preventDefault()
        undo()
        return
      }
    },
    [toggle, undo],
  )

  useEffect(() => {
    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [handleKeyDown])

  return (
    <div className="flex h-screen flex-col bg-surface text-text-primary">
      <TitleBar />

      <div className="flex flex-1 overflow-hidden pt-9">
        <div className="flex flex-1 items-center justify-center p-4">
          <Board />
        </div>

        <div className="flex w-56 flex-col border-l border-border">
          <div className="flex-1 overflow-hidden">
            <MoveHistory />
          </div>
          <ControlBar />
        </div>
      </div>

      <MoveInput />
    </div>
  )
}
