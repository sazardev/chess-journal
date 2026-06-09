import { useState, useRef, useCallback } from "react"
import { useGameStore } from "../stores/useGameStore"

export default function MoveInput() {
  const [value, setValue] = useState("")
  const [error, setError] = useState("")
  const inputRef = useRef<HTMLInputElement>(null)
  const makeMoveSan = useGameStore((s) => s.makeMoveSan)
  const turn = useGameStore((s) => s.turn)
  const isGameOver = useGameStore((s) => s.isGameOver)

  const handleSubmit = useCallback(() => {
    const san = value.trim()
    if (!san) return

    const ok = makeMoveSan(san)
    if (!ok) {
      setError("Illegal move")
      setTimeout(() => setError(""), 1500)
    } else {
      setValue("")
      setError("")
    }
  }, [value, makeMoveSan])

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter") {
        e.preventDefault()
        handleSubmit()
      }
      if (e.key === "Escape") {
        setValue("")
        setError("")
        inputRef.current?.blur()
      }
    },
    [handleSubmit],
  )

  const indicator = turn === "w" ? "○" : "●"

  return (
    <div className="flex items-center gap-2 border-t border-border px-4 py-2">
      <span className="font-mono text-xs text-text-secondary">
        {isGameOver ? "=" : indicator}
      </span>
      <input
        ref={inputRef}
        type="text"
        value={value}
        onChange={(e) => {
          setValue(e.target.value)
          setError("")
        }}
        onKeyDown={handleKeyDown}
        placeholder={error || "e4, Nf3, O-O, exd5..."}
        className={`flex-1 bg-transparent font-mono text-sm outline-none placeholder:text-text-secondary/40 ${
          error ? "text-red-500" : "text-text-primary"
        }`}
        spellCheck={false}
        autoComplete="off"
      />
      <button
        onClick={handleSubmit}
        className="font-mono text-[10px] uppercase tracking-widest text-text-secondary transition-colors hover:text-text-primary"
      >
        Play
      </button>
    </div>
  )
}
