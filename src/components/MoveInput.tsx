import { useState, useRef, useCallback, type RefObject } from "react"
import { useGameStore } from "../stores/useGameStore"

export default function MoveInput({ inputRef }: { inputRef?: RefObject<HTMLInputElement | null> }) {
  const [value, setValue] = useState("")
  const [error, setError] = useState("")
  const internalRef = useRef<HTMLInputElement>(null)
  const inputRef_ = inputRef ?? internalRef
  const makeMoveSan = useGameStore((s) => s.makeMoveSan)
  const turn = useGameStore((s) => s.turn)
  const isGameOver = useGameStore((s) => s.isGameOver)

  const handleSubmit = useCallback(() => {
    const san = value.trim()
    if (!san) return

    const result = makeMoveSan(san)
    if (!result) {
      setError(`"${san}" is not a legal move`)
      setValue("")
      setTimeout(() => setError(""), 2500)
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
        inputRef_.current?.blur()
      }
    },
    [handleSubmit],
  )

  const label = isGameOver ? "=" : turn === "w" ? "White" : "Black"

  return (
    <div className="relative px-3 md:px-4 py-2 md:py-3">
      {error && (
        <div className="absolute -top-5 md:-top-6 left-3 md:left-4 right-3 md:right-4 font-mono text-[10px] md:text-[11px] text-gray-400 truncate">
          {error}
        </div>
      )}
      <div className="flex items-center gap-2 md:gap-3">
        <span className={`font-mono text-[10px] uppercase tracking-[0.1em] tabular-nums shrink-0 ${
          isGameOver ? "text-gray-400" : "text-black"
        }`}>
          {label}
        </span>
        <input
          ref={inputRef_}
          type="text"
          value={value}
          onChange={(e) => {
            setValue(e.target.value)
            setError("")
          }}
          onKeyDown={handleKeyDown}
          disabled={isGameOver}
          placeholder="e4, Nf3, O-O..."
          className="flex-1 bg-transparent font-mono text-sm outline-none placeholder:text-gray-300 disabled:opacity-30 text-black min-w-0 py-1"
          spellCheck={false}
          autoComplete="off"
        />
        <button
          onClick={handleSubmit}
          disabled={isGameOver}
          className="font-mono text-[10px] uppercase tracking-widest text-gray-400 hover:text-black transition-colors disabled:opacity-30 shrink-0 py-1"
        >
          Play
        </button>
      </div>
    </div>
  )
}
