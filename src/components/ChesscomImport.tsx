import { useCallback, useEffect, useRef, useState } from "react"
import type { SaveData } from "../types/save"
import { useLibraryStore } from "../stores/useLibraryStore"
import { useChesscomStore } from "../stores/useChesscomStore"
import { fetchArchives, getAvailableMonths, importGames, type ArchiveInfo, type ImportProgress } from "../lib/chesscom"

interface Props {
  onClose: () => void
}

const now = new Date()
const CURRENT_YEAR = now.getFullYear()
const CURRENT_MONTH = now.getMonth() + 1

const MONTHS = [
  ["01", "Jan"], ["02", "Feb"], ["03", "Mar"], ["04", "Apr"],
  ["05", "May"], ["06", "Jun"], ["07", "Jul"], ["08", "Aug"],
  ["09", "Sep"], ["10", "Oct"], ["11", "Nov"], ["12", "Dec"],
] as const

function monthLabel(n: number): string {
  return MONTHS[n - 1]?.[1] ?? String(n)
}

function monthNum(n: number): string {
  return MONTHS[n - 1]?.[0] ?? String(n).padStart(2, "0")
}

export default function ChesscomImport({ onClose }: Props) {
  const savedUsers = useChesscomStore((s) => s.savedUsers)
  const toggleAutoFetch = useChesscomStore((s) => s.toggleAutoFetch)
  const removeUser = useChesscomStore((s) => s.removeUser)
  const [username, setUsername] = useState("")
  const [fromMonth, setFromMonth] = useState(1)
  const [fromYear, setFromYear] = useState(CURRENT_YEAR)
  const [toMonth, setToMonth] = useState(CURRENT_MONTH)
  const [toYear, setToYear] = useState(CURRENT_YEAR)
  const [phase, setPhase] = useState<"idle" | "loading" | "preview" | "importing" | "done">("idle")
  const [archives, setArchives] = useState<ArchiveInfo[]>([])
  const [progress, setProgress] = useState<ImportProgress | null>(null)
  const [result, setResult] = useState<{ imported: number; errors: number } | null>(null)
  const [error, setError] = useState("")
  const abortRef = useRef(false)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (inputRef.current) inputRef.current.focus()
  }, [])

  const availableMonths = getAvailableMonths(archives, fromYear, fromMonth, toYear, toMonth)

  const handleFetch = useCallback(async () => {
    const trimmed = username.trim()
    if (!trimmed) return
    setError("")
    setPhase("loading")
    try {
      const all = await fetchArchives(trimmed)
      setArchives(all)
      if (all.length === 0) {
        setError("No games found for this player")
        setPhase("idle")
        return
      }
      // Default range: oldest to newest available month
      const oldest = all[all.length - 1]
      const newest = all[0]
      setFromYear(oldest.year)
      setFromMonth(oldest.month)
      setToYear(newest.year)
      setToMonth(newest.month)
      setPhase("preview")
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to fetch archives")
      setPhase("idle")
    }
  }, [username])

  const handleImport = useCallback(async () => {
    const trimmed = username.trim()
    if (!trimmed || availableMonths.length === 0) return

    setPhase("importing")
    setError("")
    setResult(null)
    abortRef.current = false

    const wrapper = async (data: SaveData) => {
      if (abortRef.current) return
      await useLibraryStore.getState().addEntry(data)
    }

    try {
      const res = await importGames(
        trimmed,
        fromYear,
        fromMonth,
        toYear,
        toMonth,
        wrapper,
        (p) => setProgress({ ...p }),
      )
      setResult(res)
      if (res.imported > 0) {
        void useChesscomStore.getState().addUser(trimmed)
      }
      setPhase("done")
    } catch (e) {
      setError(e instanceof Error ? e.message : "Import failed")
      setPhase("preview")
    }
  }, [username, fromYear, fromMonth, toYear, toMonth, availableMonths.length, abortRef])

  const handleCancel = useCallback(() => {
    abortRef.current = true
    setPhase("done")
    setResult((r) => r ?? { imported: 0, errors: 0 })
  }, [abortRef])

  const handleChipClick = useCallback(async (user: string) => {
    setUsername(user)
    setError("")
    setPhase("loading")
    try {
      const all = await fetchArchives(user)
      setArchives(all)
      if (all.length === 0) {
        setError("No games found for this player")
        setPhase("idle")
        return
      }
      const oldest = all[all.length - 1]
      const newest = all[0]
      setFromYear(oldest.year)
      setFromMonth(oldest.month)
      setToYear(newest.year)
      setToMonth(newest.month)
      setPhase("preview")
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to fetch archives")
      setPhase("idle")
    }
  }, [])

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex items-center justify-between px-3 pb-1 pt-1.5">
        <span className="font-mono text-[10px] md:text-[9px] uppercase tracking-[0.1em] text-gray-400">
          Chess.com
        </span>
        <button
          onClick={onClose}
          className="font-mono text-[9px] uppercase text-gray-400 hover:text-black transition-colors"
        >
          Back
        </button>
      </div>

      {error && (
        <div className="px-3 pb-1">
          <p className="font-mono text-[9px] text-red-500">{error}</p>
        </div>
      )}

      {savedUsers.length > 0 && (
        <div className="flex flex-wrap items-center gap-1 px-3 pb-1.5">
          {savedUsers.map((u) => (
            <div
              key={u.username}
              className="flex items-center gap-0.5 bg-gray-50 px-1.5 py-0.5"
            >
              <button
                onClick={() => handleChipClick(u.username)}
                className="font-mono text-[9px] text-black hover:text-gray-500 transition-colors"
              >
                {u.username}
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  void toggleAutoFetch(u.username)
                }}
                title={u.autoFetch ? "Auto-fetch on" : "Auto-fetch off"}
                className={`font-mono text-[10px] leading-none px-0.5 transition-colors ${
                  u.autoFetch ? "text-black" : "text-gray-300 hover:text-gray-400"
                }`}
              >
                ↻
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  void removeUser(u.username)
                }}
                className="font-mono text-[10px] text-gray-300 hover:text-black transition-colors px-0.5"
              >
                ×
              </button>
            </div>
          ))}
        </div>
      )}

      {phase === "idle" && (
        <div className="flex-1 flex flex-col gap-2 px-3 pt-1">
          <input
            ref={inputRef}
            type="text"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") handleFetch() }}
            placeholder="Chess.com username"
            className="bg-gray-50 font-mono text-[11px] md:text-[10px] outline-none placeholder:text-gray-300 text-black px-2 py-1.5 md:px-1.5 md:py-0.5"
          />

          <button
            onClick={handleFetch}
            disabled={!username.trim()}
            className="font-mono text-[9px] uppercase tracking-[0.08em] bg-black text-white hover:bg-gray-800 disabled:opacity-30 disabled:cursor-not-allowed transition-colors px-2 py-1.5"
          >
            Fetch games
          </button>
        </div>
      )}

      {phase === "loading" && (
        <div className="flex-1 flex items-center justify-center px-3">
          <p className="font-mono text-[10px] text-gray-400">Fetching archives...</p>
        </div>
      )}

      {(phase === "preview" || phase === "importing" || phase === "done") && (
        <>
          <div className="flex items-center justify-between px-3 pb-1 pt-1">
            <span className="font-mono text-[8px] text-gray-400 uppercase tracking-[0.08em]">
              {availableMonths.length} month{availableMonths.length !== 1 ? "s" : ""}
            </span>
          </div>

          <div className="flex items-center gap-1 px-3 pb-1.5">
            <span className="font-mono text-[8px] text-gray-400 uppercase tracking-[0.08em]">From</span>
            <select
              value={fromMonth}
              onChange={(e) => setFromMonth(+e.target.value)}
              className="bg-gray-50 font-mono text-[10px] outline-none text-black px-1 py-0.5 appearance-none"
            >
              {MONTHS.map(([n, label]) => (
                <option key={n} value={+n}>{label}</option>
              ))}
            </select>
            <input
              type="number"
              value={fromYear}
              onChange={(e) => setFromYear(+e.target.value || CURRENT_YEAR)}
              className="w-14 bg-gray-50 font-mono text-[10px] outline-none text-black px-1 py-0.5"
              min={2007}
              max={CURRENT_YEAR}
            />
            <span className="font-mono text-[8px] text-gray-400 uppercase tracking-[0.08em] ml-1">To</span>
            <select
              value={toMonth}
              onChange={(e) => setToMonth(+e.target.value)}
              className="bg-gray-50 font-mono text-[10px] outline-none text-black px-1 py-0.5 appearance-none"
            >
              {MONTHS.map(([n, label]) => (
                <option key={n} value={+n}>{label}</option>
              ))}
            </select>
            <input
              type="number"
              value={toYear}
              onChange={(e) => setToYear(+e.target.value || CURRENT_YEAR)}
              className="w-14 bg-gray-50 font-mono text-[10px] outline-none text-black px-1 py-0.5"
              min={2007}
              max={CURRENT_YEAR}
            />
          </div>

          <div className="flex-1 overflow-y-auto px-3 pb-2">
            {availableMonths.map((a) => {
              const key = `${a.year}-${monthNum(a.month)}`
              return (
                <div
                  key={key}
                  className="flex items-center gap-1.5 w-full text-left py-1 px-1 -mx-1"
                >
                  <span className="font-mono text-[10px] tabular-nums text-gray-400">
                    {monthLabel(a.month)} {a.year}
                  </span>
                </div>
              )
            })}
          </div>

          <div className="px-3 pb-2">
            {result && (
              <p className="font-mono text-[9px] text-gray-400 pb-1">
                Imported {result.imported} game{result.imported !== 1 ? "s" : ""}
                {result.errors > 0 && ` (${result.errors} failed)`}
              </p>
            )}
            {phase === "importing" && progress && (
              <div className="pb-1">
                <p className="font-mono text-[9px] text-gray-400 truncate">{progress.message}</p>
                <div className="mt-0.5 h-0.5 bg-gray-100">
                  <div
                    className="h-full bg-black transition-all duration-300"
                    style={{ width: `${progress.total > 0 ? (progress.current / progress.total) * 100 : 0}%` }}
                  />
                </div>
              </div>
            )}
            <div className="flex gap-1">
              {phase === "importing" ? (
                <button
                  onClick={handleCancel}
                  className="flex-1 font-mono text-[9px] uppercase tracking-[0.08em] bg-gray-100 text-gray-400 hover:text-black hover:bg-gray-200 transition-colors px-2 py-1.5"
                >
                  Cancel
                </button>
              ) : (
                <>
                  <button
                    onClick={onClose}
                    className="flex-1 font-mono text-[9px] uppercase tracking-[0.08em] text-gray-400 hover:text-black hover:bg-gray-100 transition-colors px-2 py-1.5"
                  >
                    {result ? "Close" : "Back"}
                  </button>
                  {!result && (
                    <button
                      onClick={handleImport}
                      disabled={availableMonths.length === 0 || phase === "done"}
                      className="flex-1 font-mono text-[9px] uppercase tracking-[0.08em] bg-black text-white hover:bg-gray-800 disabled:opacity-30 disabled:cursor-not-allowed transition-colors px-2 py-1.5"
                    >
                      Import {availableMonths.length > 0 ? `(${availableMonths.length})` : ""}
                    </button>
                  )}
                </>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  )
}
