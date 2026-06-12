import { useState, useRef, useMemo, useCallback, type RefObject } from "react"
import { Chess, type Square } from "chess.js"
import { useGameStore } from "../stores/useGameStore"
import { useConfigStore } from "../stores/useConfigStore"
import { candidateColor } from "../lib/heatmap"
import type { Candidate, useEngine } from "../hooks/useEngine"

const MAX_SUGGESTIONS = 8
const NO_CANDIDATES: Candidate[] = []

interface Props {
  inputRef?: RefObject<HTMLInputElement | null>
  engine?: ReturnType<typeof useEngine>
}

export default function MoveInput({ inputRef, engine }: Props) {
  const [value, setValue] = useState("")
  const [error, setError] = useState("")
  const [focused, setFocused] = useState(false)
  const [selected, setSelected] = useState(-1)
  const internalRef = useRef<HTMLInputElement>(null)
  const inputRef_ = inputRef ?? internalRef

  const makeMoveSan = useGameStore((s) => s.makeMoveSan)
  const fen = useGameStore((s) => s.fen)
  const turn = useGameStore((s) => s.turn)
  const isGameOver = useGameStore((s) => s.isGameOver)

  const assistiveMode = useConfigStore((s) => s.assistiveMode)
  const assistiveColor = useConfigStore((s) => s.assistiveColor)
  const assistiveBlocked =
    assistiveMode &&
    fen.split(" ")[1] !== assistiveColor[0]
  const inputDisabled = isGameOver || assistiveBlocked

  const analyzerOn = engine?.enabled ?? false
  const candidates = engine?.candidates ?? NO_CANDIDATES

  // Legal moves for the current position — recomputed only when the position
  // changes, never per keystroke.
  const legalMoves = useMemo(() => {
    try {
      return new Chess(fen).moves()
    } catch {
      return []
    }
  }, [fen])

  // Optional eval hint per move when the analyzer is on (cheap: ≤8 candidates).
  const evalBySan = useMemo(() => {
    const map = new Map<string, { label: string; color: string }>()
    if (!analyzerOn || candidates.length === 0) return map
    for (const c of candidates) {
      try {
        const from = c.uci.slice(0, 2) as Square
        const to = c.uci.slice(2, 4) as Square
        const promotion = c.uci.length > 4 ? c.uci[4] : undefined
        const m = new Chess(fen).move({ from, to, promotion })
        if (!m) continue
        const label =
          c.mate !== null
            ? `M${Math.abs(c.mate)}`
            : c.score > 0
              ? `+${(c.score / 100).toFixed(1)}`
              : (c.score / 100).toFixed(1)
        map.set(m.san, { label, color: candidateColor(candidates, c) })
      } catch {
        /* skip */
      }
    }
    return map
  }, [fen, analyzerOn, candidates])

  const suggestions = useMemo(() => {
    const q = value.trim().toLowerCase()
    if (!q) return []
    return legalMoves.filter((m) => m.toLowerCase().startsWith(q)).slice(0, MAX_SUGGESTIONS)
  }, [value, legalMoves])

  const showSuggestions = focused && value.trim().length > 0 && suggestions.length > 0

  const play = useCallback(
    (san: string) => {
      const result = makeMoveSan(san)
      if (!result) {
        setError(`"${san}" is not a legal move`)
        setValue("")
        setTimeout(() => setError(""), 2500)
      } else {
        setValue("")
        setError("")
        setSelected(-1)
      }
    },
    [makeMoveSan],
  )

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "ArrowDown" && showSuggestions) {
        e.preventDefault()
        setSelected((i) => Math.min(suggestions.length - 1, i + 1))
        return
      }
      if (e.key === "ArrowUp" && showSuggestions) {
        e.preventDefault()
        setSelected((i) => Math.max(-1, i - 1))
        return
      }
      if (e.key === "Tab" && showSuggestions) {
        e.preventDefault()
        const pick = suggestions[selected >= 0 ? selected : 0]
        if (pick) {
          setValue(pick)
          setSelected(-1)
        }
        return
      }
      if (e.key === "Enter") {
        e.preventDefault()
        if (showSuggestions && selected >= 0) {
          play(suggestions[selected])
        } else {
          const san = value.trim()
          if (san) play(san)
        }
        return
      }
      if (e.key === "Escape") {
        if (showSuggestions) {
          setSelected(-1)
          setValue("")
          return
        }
        setValue("")
        setError("")
        inputRef_.current?.blur()
      }
    },
    [showSuggestions, suggestions, selected, value, play, inputRef_],
  )

  const label = isGameOver ? "=" : turn === "w" ? "White" : "Black"

  return (
    <div className="relative px-3 md:px-4 py-2 md:py-3">
      {error && (
        <div className="absolute -top-5 md:-top-6 left-3 md:left-4 right-3 md:right-4 font-mono text-[10px] md:text-[11px] text-gray-400 truncate">
          {error}
        </div>
      )}

      {showSuggestions && (
        <div className="absolute bottom-full left-3 right-3 md:left-4 md:right-4 mb-1 max-h-44 overflow-y-auto border border-gray-100 bg-white shadow-lg">
          {suggestions.map((san, i) => {
            const hint = evalBySan.get(san)
            return (
              <button
                key={san}
                // mousedown fires before blur, so the click still registers
                onMouseDown={(e) => {
                  e.preventDefault()
                  play(san)
                }}
                onMouseEnter={() => setSelected(i)}
                className={`flex w-full items-center justify-between gap-2 px-3 py-1.5 text-left font-mono text-[11px] transition-colors ${
                  i === selected ? "bg-black text-white" : "text-black hover:bg-gray-100"
                }`}
              >
                <span className="tabular-nums">{san}</span>
                {hint && (
                  <span className="flex items-center gap-1 shrink-0">
                    <span
                      className="h-1.5 w-1.5 rounded-full"
                      style={{ backgroundColor: hint.color }}
                    />
                    <span className={`tabular-nums text-[10px] ${i === selected ? "text-gray-300" : "text-gray-400"}`}>
                      {hint.label}
                    </span>
                  </span>
                )}
              </button>
            )
          })}
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
            setSelected(-1)
          }}
          onKeyDown={handleKeyDown}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          disabled={inputDisabled}
          placeholder={assistiveBlocked ? "Engine thinking…" : "e4, Nf3, O-O…  (Tab to complete)"}
          className="flex-1 bg-transparent font-mono text-sm outline-none placeholder:text-gray-300 disabled:opacity-30 text-black min-w-0 py-1"
          spellCheck={false}
          autoComplete="off"
        />
        <button
          onClick={() => {
            const san = value.trim()
            if (san) play(san)
          }}
          disabled={inputDisabled}
          className="font-mono text-[10px] uppercase tracking-widest text-gray-400 hover:text-black transition-colors disabled:opacity-30 shrink-0 py-1"
        >
          Play
        </button>
      </div>
    </div>
  )
}
