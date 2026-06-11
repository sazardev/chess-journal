import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import type { Square } from "chess.js"
import { useLibraryStore } from "../stores/useLibraryStore"
import { usePersistenceStore } from "../stores/usePersistenceStore"
import { useGameStore } from "../stores/useGameStore"
import { useBoardStore } from "../stores/useBoardStore"
import { useMetaStore } from "../stores/useMetaStore"
import { newGame } from "../lib/session"
import { useTouch } from "../hooks/useTouch"
import OpeningStats from "./OpeningStats"
import PuzzleList from "./PuzzleList"
import { usePuzzleStore } from "../stores/usePuzzleStore"
import type { Puzzle } from "../data/puzzles"
import { HISTORIC, loadClassics, type ClassicGame, type ClassicCategory } from "../data/classics"

const CAT_ORDER: ClassicCategory[] = ["historic", "bullet", "blitz", "rapid", "classical"]
const CAT_LABEL: Record<ClassicCategory, string> = {
  historic: "Classic",
  bullet: "Bullet",
  blitz: "Blitz",
  rapid: "Rapid",
  classical: "Classical",
}

function plyCount(moves: string): number {
  return moves.replace(/\d+\.(\.\.)?/g, " ").trim().split(/\s+/).filter(Boolean).length
}

const SORT_LABELS = ["Newest", "Oldest", "A-Z", "Z-A", "Moves ↑", "Moves ↓", "Rating ↑", "Rating ↓"] as const

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return "now"
  if (mins < 60) return `${mins}m ago`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  if (days < 7) return `${days}d ago`
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" })
}

interface Props {
  open: boolean
  onToggle: () => void
}

export default function Library({ open, onToggle }: Props) {
  const entries = useLibraryStore((s) => s.entries)
  const removeEntry = useLibraryStore((s) => s.removeEntry)
  const togglePin = useLibraryStore((s) => s.togglePin)
  const toggleFavorite = useLibraryStore((s) => s.toggleFavorite)
  const updateEntryMeta = useLibraryStore((s) => s.updateEntryMeta)
  const [loadedId, setLoadedId] = useState<string | null>(null)
  const [search, setSearch] = useState("")
  const [sortIdx, setSortIdx] = useState(0)
  const [filter, setFilter] = useState<"all" | "pinned" | "favorite">("all")
  const [statsOpen, setStatsOpen] = useState(false)
  const [tab, setTab] = useState<"mine" | "classics" | "puzzles">("mine")
  const [classicsSearch, setClassicsSearch] = useState("")
  const [classicsCat, setClassicsCat] = useState<"all" | ClassicCategory>("all")
  const [classicsGames, setClassicsGames] = useState<ClassicGame[]>(HISTORIC)

  const touch = useTouch()
  // On touch there's no hover — keep row actions visible instead of hover-revealed.
  const actionVis = touch ? "opacity-100" : "opacity-0 group-hover:opacity-100"

  useEffect(() => {
    if (tab === "classics") loadClassics().then(setClassicsGames)
  }, [tab])
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editValue, setEditValue] = useState("")
  const [deletedEntry, setDeletedEntry] = useState<{ id: string; entry: ReturnType<typeof useLibraryStore.getState>["entries"][0] } | null>(null)
  const searchRef = useRef<HTMLInputElement>(null)
  const undoRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)

  useEffect(() => {
    if (open && searchRef.current) {
      // Don't pop the keyboard on touch — only focus search on desktop.
      if (!touch) searchRef.current.focus()
      setSearch("")
      setSortIdx(0)
      setFilter("all")
    }
  }, [open, touch])

  useEffect(() => {
    return () => {
      if (undoRef.current !== undefined) clearTimeout(undoRef.current)
    }
  }, [])

  const handleLoad = useCallback(
    (entryId: string) => {
      usePuzzleStore.getState().exit()

      const state = useLibraryStore.getState()
      const entry = state.entries.find((e) => e.id === entryId)
      if (!entry) return

      const { game, board } = entry.data
      if (!game || !game.fullHistory) return

      useGameStore.getState().restoreState({ ...game, currentLibraryId: entryId })
      useMetaStore.getState().load(entry.data.meta)

      const b = useBoardStore.getState()
      b.clearAll()
      for (const a of board?.arrows ?? []) {
        b.addArrow(a.from as Square, a.to as Square)
      }
      for (const [sq, color] of Object.entries(board?.highlights ?? {})) {
        b.highlightSquare(sq as Square, color)
      }

      setLoadedId(entryId)
      setTimeout(() => setLoadedId(null), 1200)
      if (window.innerWidth < 1024) onToggle()
    },
    [onToggle],
  )

  const handleDelete = useCallback(
    (e: React.MouseEvent, id: string) => {
      e.stopPropagation()
      const entry = useLibraryStore.getState().entries.find((x) => x.id === id)
      if (!entry) return
      removeEntry(id)
      setDeletedEntry({ id, entry })
      if (useGameStore.getState().currentLibraryId === id) {
        useGameStore.setState({ currentLibraryId: null })
      }
      if (undoRef.current !== undefined) clearTimeout(undoRef.current)
      undoRef.current = setTimeout(() => setDeletedEntry(null), 5000)
    },
    [removeEntry],
  )

  const handleUndoDelete = useCallback(() => {
    if (!deletedEntry) return
    const { entries } = useLibraryStore.getState()
    const next = [deletedEntry.entry, ...entries].slice(0, 50)
    useLibraryStore.setState({ entries: next })
    usePersistenceStore.getState().writeLibrary(next)
    setDeletedEntry(null)
    if (undoRef.current !== undefined) clearTimeout(undoRef.current)
  }, [deletedEntry])

  const handleStartEdit = useCallback(
    (e: React.MouseEvent, id: string, name: string) => {
      e.stopPropagation()
      setEditingId(id)
      setEditValue(name)
    },
    [],
  )

  const handleSaveEdit = useCallback(
    (id: string) => {
      const trimmed = editValue.trim()
      updateEntryMeta(id, { name: trimmed || "Untitled" })
      if (useGameStore.getState().currentLibraryId === id) {
        useMetaStore.getState().setName(trimmed || "Untitled")
      }
      setEditingId(null)
      setEditValue("")
    },
    [editValue, updateEntryMeta],
  )

  const handlePin = useCallback(
    (e: React.MouseEvent, id: string) => {
      e.stopPropagation()
      togglePin(id)
    },
    [togglePin],
  )

  const handleFavorite = useCallback(
    (e: React.MouseEvent, id: string) => {
      e.stopPropagation()
      toggleFavorite(id)
    },
    [toggleFavorite],
  )

  const handleCycleSort = useCallback(() => {
    setSortIdx((i) => (i + 1) % SORT_LABELS.length)
  }, [])

  const handleNewClick = useCallback(() => {
    newGame()
  }, [])

  const handleLoadClassic = useCallback((g: ClassicGame) => {
    usePuzzleStore.getState().exit()
    // loadClassic sets the working game as transient (autosave skips it).
    useGameStore.getState().loadClassic(g.moves)
    useMetaStore.getState().load({
      name: `${g.white} — ${g.black}`,
      rating: 0,
      tags: g.tags,
      notes: `${g.event}, ${g.year}`,
      result: g.result,
      playerColor: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    })
    useBoardStore.getState().clearAll()
    setLoadedId(g.id)
    setTimeout(() => setLoadedId(null), 1200)
    if (window.innerWidth < 1024) onToggle()
  }, [onToggle])

  const handleStartPuzzle = useCallback(
    (queue: Puzzle[], index: number) => {
      usePuzzleStore.getState().load(queue, index)
      if (window.innerWidth < 1024) onToggle()
    },
    [onToggle],
  )

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim()
    const byFilter =
      filter === "pinned"
        ? entries.filter((e) => e.pinned)
        : filter === "favorite"
          ? entries.filter((e) => e.favorite)
          : entries
    const filtered = q
      ? byFilter.filter(
          (e) =>
            e.data.meta.name.toLowerCase().includes(q) ||
            e.data.meta.tags.some((t) => t.toLowerCase().includes(q)) ||
            e.data.meta.notes.toLowerCase().includes(q) ||
            (e.data.meta.opening?.name.toLowerCase().includes(q) ?? false),
        )
      : byFilter

    const getMoves = (e: (typeof entries)[0]) => e.data.game.fullHistory?.length ?? 0
    const getRating = (e: (typeof entries)[0]) => e.data.meta.rating ?? 0

    const sorted = [...filtered].sort((a, b) => {
      switch (sortIdx) {
        case 0:
          return new Date(b.savedAt).getTime() - new Date(a.savedAt).getTime()
        case 1:
          return new Date(a.savedAt).getTime() - new Date(b.savedAt).getTime()
        case 2:
          return (a.data.meta.name || "").localeCompare(b.data.meta.name || "")
        case 3:
          return (b.data.meta.name || "").localeCompare(a.data.meta.name || "")
        case 4:
          return getMoves(a) - getMoves(b)
        case 5:
          return getMoves(b) - getMoves(a)
        case 6:
          return getRating(a) - getRating(b)
        case 7:
          return getRating(b) - getRating(a)
        default:
          return 0
      }
    })

    // Only group by pin in the default view; filtered views show a flat list.
    if (filter !== "all") {
      return { pinned: [], unpinned: sorted, total: sorted.length }
    }
    const pinned = sorted.filter((e) => e.pinned)
    const unpinned = sorted.filter((e) => !e.pinned)
    return { pinned, unpinned, total: sorted.length }
  }, [entries, search, sortIdx, filter])

  const classicsView = useMemo(() => {
    const q = classicsSearch.toLowerCase().trim()
    const cats = CAT_ORDER.filter((c) => classicsGames.some((g) => g.category === c))
    const list = classicsGames.filter((g) => {
      if (classicsCat !== "all" && g.category !== classicsCat) return false
      if (!q) return true
      return (
        (g.opening ?? "").toLowerCase().includes(q) ||
        g.white.toLowerCase().includes(q) ||
        g.black.toLowerCase().includes(q) ||
        (g.eco ?? "").toLowerCase().includes(q) ||
        g.event.toLowerCase().includes(q) ||
        g.tags.some((t) => t.toLowerCase().includes(q))
      )
    })
    return { list, cats }
  }, [classicsSearch, classicsCat, classicsGames])

  const renderEntry = (entry: (typeof entries)[0]) => {
    const isLoaded = loadedId === entry.id
    const isEditing = editingId === entry.id

    return (
      <div
        key={entry.id}
        className={`group relative -mx-2 px-2 py-1.5 transition-colors hover:bg-gray-50 ${
          isLoaded ? "bg-gray-100" : ""
        }`}
      >
        {isEditing ? (
          <div className="flex items-center gap-1">
            <input
              autoFocus
              value={editValue}
              onChange={(e) => setEditValue(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleSaveEdit(entry.id)
                if (e.key === "Escape") {
                  setEditingId(null)
                  setEditValue("")
                }
              }}
              onClick={(e) => e.stopPropagation()}
              placeholder="Name..."
              className="flex-1 bg-transparent font-mono text-[10px] md:text-[11px] outline-none placeholder:text-gray-300 text-black"
            />
            <button
              onClick={(e) => {
                e.stopPropagation()
                handleSaveEdit(entry.id)
              }}
              className="font-mono text-[9px] uppercase text-gray-400 hover:text-black"
            >
              Save
            </button>
          </div>
        ) : (
          <button
            onClick={() => handleLoad(entry.id)}
            className="w-full text-left"
          >
            <div className="flex items-start justify-between gap-1">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1">
                  {entry.favorite && (
                    <span className="shrink-0 text-[9px] leading-none">♥</span>
                  )}
                  {entry.pinned && (
                    <span className="shrink-0 text-[9px] leading-none">★</span>
                  )}
                  <p className="font-mono text-[10px] md:text-[11px] text-black truncate">
                    {entry.data.meta.name || "Untitled"}
                    {isLoaded && (
                      <span className="ml-1 text-[8px] text-gray-400 font-normal">loaded</span>
                    )}
                  </p>
                </div>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className="font-mono text-[8px] text-gray-400">
                    {relativeTime(entry.savedAt)}
                  </span>
                  <span className="font-mono text-[8px] tabular-nums text-gray-400">
                    {entry.data.game.fullHistory?.length ?? 0} moves
                  </span>
                  {entry.data.meta.rating > 0 && (
                    <span className="font-mono text-[8px] tabular-nums text-gray-300">
                      {"★".repeat(Math.min(5, Math.ceil(entry.data.meta.rating / 2)))}
                    </span>
                  )}
                  {entry.data.meta.tags.length > 0 && (
                    <span className="font-mono text-[8px] text-gray-300 truncate max-w-[80px]">
                      {entry.data.meta.tags.slice(0, 3).join(", ")}
                    </span>
                  )}
                </div>
                {entry.data.meta.opening && (
                  <div className="mt-0.5 flex items-center gap-1">
                    <span className="font-mono text-[7px] tabular-nums text-gray-300">
                      {entry.data.meta.opening.eco}
                    </span>
                    <span className="font-mono text-[8px] text-gray-400 truncate">
                      {entry.data.meta.opening.name}
                    </span>
                  </div>
                )}
              </div>
              <div className="flex items-center gap-0.5 shrink-0">
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    e.preventDefault()
                    handleStartEdit(e, entry.id, entry.data.meta.name)
                  }}
                  className={`font-mono text-sm ${actionVis} text-gray-400 hover:text-black transition-all px-0.5`}
                >
                  ✎
                </button>
                <button
                  onClick={(e) => handleFavorite(e, entry.id)}
                  title="Favorite"
                  className={`font-mono text-sm transition-all px-0.5 ${
                    entry.favorite
                      ? "text-black"
                      : `${actionVis} text-gray-400 hover:text-black`
                  }`}
                >
                  {entry.favorite ? "♥" : "♡"}
                </button>
                <button
                  onClick={(e) => handlePin(e, entry.id)}
                  title="Pin"
                  className={`font-mono text-sm transition-all px-0.5 ${
                    entry.pinned
                      ? "text-black"
                      : `${actionVis} text-gray-400 hover:text-black`
                  }`}
                >
                  ★
                </button>
                <button
                  onClick={(e) => handleDelete(e, entry.id)}
                  className={`font-mono text-sm ${actionVis} text-gray-400 hover:text-black transition-all px-0.5`}
                >
                  ×
                </button>
              </div>
            </div>
          </button>
        )}
      </div>
    )
  }

  return (
    <div className="relative z-40 flex shrink-0 max-lg:absolute max-lg:inset-y-0 max-lg:left-0">
      <div
        className={`overflow-hidden transition-all duration-200 max-lg:shadow-xl ${
          open ? "w-screen md:w-72 lg:w-80" : "w-0"
        }`}
      >
        <div className="w-screen md:w-72 lg:w-80 h-full flex flex-col bg-white">
          {/* On mobile the contextual app bar shows "Library" + back, so this
              row is just the actions, right-aligned. */}
          <div className="flex items-center justify-between px-3 py-2 max-md:justify-end">
            <span className="hidden md:inline font-mono text-[10px] uppercase tracking-[0.15em] text-gray-400">
              Library
            </span>
            <div className="flex items-center gap-3 md:gap-2">
              <button
                onClick={() => setStatsOpen(true)}
                className="font-mono text-[10px] md:text-[9px] uppercase tracking-[0.1em] text-gray-400 hover:text-black transition-colors"
              >
                Stats
              </button>
              <button
                onClick={handleNewClick}
                className="font-mono text-[10px] md:text-[9px] uppercase tracking-[0.1em] text-gray-400 hover:text-black transition-colors"
              >
                New
              </button>
              <span className="font-mono text-[9px] tabular-nums text-gray-300">
                {entries.length}
              </span>
            </div>
          </div>

          <div className="flex border-y border-gray-100">
            {(["mine", "classics", "puzzles"] as const).map((t) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={`flex-1 font-mono text-[10px] md:text-[8px] uppercase tracking-[0.12em] py-3 md:py-1.5 transition-colors ${
                  tab === t ? "bg-black text-white" : "text-gray-400 hover:text-black hover:bg-gray-100"
                }`}
              >
                {t === "mine" ? "My games" : t === "classics" ? "Classics" : "Puzzles"}
              </button>
            ))}
          </div>

          {tab === "mine" && (
          <div className="flex min-h-0 flex-1 flex-col">
          <div className="flex items-center gap-1 px-3 pb-1.5 pt-1.5">
            <input
              ref={searchRef}
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search..."
              className="flex-1 bg-gray-50 font-mono text-[10px] outline-none placeholder:text-gray-300 text-black px-1.5 py-0.5"
            />
            <button
              onClick={handleCycleSort}
              className="shrink-0 font-mono text-[8px] uppercase tracking-[0.05em] px-1.5 py-0.5 bg-gray-50 text-gray-400 hover:text-black transition-colors"
            >
              {SORT_LABELS[sortIdx]}
            </button>
          </div>

          <div className="flex items-center gap-1 px-3 pb-1.5">
            {([
              ["all", "All"],
              ["pinned", "★ Pinned"],
              ["favorite", "♥ Favorites"],
            ] as const).map(([key, label]) => (
              <button
                key={key}
                onClick={() => setFilter(key)}
                className={`font-mono text-[8px] uppercase tracking-[0.08em] px-1.5 py-0.5 transition-colors ${
                  filter === key
                    ? "bg-black text-white"
                    : "text-gray-400 hover:text-black hover:bg-gray-100"
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          {deletedEntry && (
            <div className="flex items-center justify-between px-3 py-1 bg-gray-50">
              <span className="font-mono text-[9px] text-gray-400 truncate">
                Deleted "{deletedEntry.entry.data.meta.name}"
              </span>
              <button
                onClick={handleUndoDelete}
                className="font-mono text-[9px] uppercase text-black hover:text-gray-400"
              >
                Undo
              </button>
            </div>
          )}

          <div className="flex-1 overflow-y-auto px-3 pb-2">
            {filtered.total === 0 && (
              <p className="py-4 text-center font-mono text-[10px] text-gray-300">
                {search
                  ? "No results"
                  : filter === "favorite"
                    ? "No favorites"
                    : filter === "pinned"
                      ? "No pinned games"
                      : "No saved games"}
              </p>
            )}

            {filtered.pinned.length > 0 && (
              <div className="mb-2">
                <span className="font-mono text-[7px] uppercase tracking-[0.15em] text-gray-400 px-0.5">
                  Pinned
                </span>
                {filtered.pinned.map(renderEntry)}
              </div>
            )}

            {filtered.unpinned.length > 0 && (
              <div>
                {filtered.pinned.length > 0 && (
                  <span className="font-mono text-[7px] uppercase tracking-[0.15em] text-gray-400 px-0.5">
                    All
                  </span>
                )}
                {filtered.unpinned.map(renderEntry)}
              </div>
            )}
          </div>
          </div>
          )}

          {tab === "classics" && (
          <div className="flex min-h-0 flex-1 flex-col">
            <div className="flex items-center gap-1 px-3 pb-1.5 pt-1.5">
              <input
                type="text"
                value={classicsSearch}
                onChange={(e) => setClassicsSearch(e.target.value)}
                placeholder="Opening, player, ECO..."
                className="flex-1 bg-gray-50 font-mono text-[10px] outline-none placeholder:text-gray-300 text-black px-1.5 py-0.5"
              />
              <span className="font-mono text-[9px] tabular-nums text-gray-300">{classicsView.list.length}</span>
            </div>

            {classicsView.cats.length > 1 && (
              <div className="flex flex-wrap items-center gap-1 px-3 pb-1.5">
                <button
                  onClick={() => setClassicsCat("all")}
                  className={`font-mono text-[8px] uppercase tracking-[0.08em] px-1.5 py-0.5 transition-colors ${
                    classicsCat === "all" ? "bg-black text-white" : "text-gray-400 hover:text-black hover:bg-gray-100"
                  }`}
                >
                  All
                </button>
                {classicsView.cats.map((c) => (
                  <button
                    key={c}
                    onClick={() => setClassicsCat(c)}
                    className={`font-mono text-[8px] uppercase tracking-[0.08em] px-1.5 py-0.5 transition-colors ${
                      classicsCat === c ? "bg-black text-white" : "text-gray-400 hover:text-black hover:bg-gray-100"
                    }`}
                  >
                    {CAT_LABEL[c]}
                  </button>
                ))}
              </div>
            )}

            <div className="min-h-0 flex-1 overflow-y-auto px-3 pb-2">
              {classicsView.list.length === 0 && (
                <p className="py-4 text-center font-mono text-[10px] text-gray-300">No games</p>
              )}
              {classicsView.list.map((g) => {
                const moves = Math.ceil(plyCount(g.moves) / 2)
                return (
                  <button
                    key={g.id}
                    onClick={() => handleLoadClassic(g)}
                    className={`group -mx-2 block w-full px-2 py-1.5 text-left transition-colors hover:bg-gray-50 ${
                      loadedId === g.id ? "bg-gray-100" : ""
                    }`}
                  >
                    <div className="flex items-center gap-1.5">
                      {g.eco && (
                        <span className="shrink-0 font-mono text-[8px] tabular-nums text-gray-400">{g.eco}</span>
                      )}
                      <span className="truncate font-mono text-[10px] md:text-[11px] text-black">
                        {g.opening || `${g.white} — ${g.black}`}
                      </span>
                      {loadedId === g.id && (
                        <span className="shrink-0 text-[8px] text-gray-400">loaded</span>
                      )}
                    </div>
                    <p className="mt-0.5 truncate font-mono text-[9px] text-gray-500">
                      {g.white}
                      {g.whiteElo ? ` (${g.whiteElo})` : ""} — {g.black}
                      {g.blackElo ? ` (${g.blackElo})` : ""}
                    </p>
                    <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 font-mono text-[8px] text-gray-400">
                      <span className="uppercase tracking-[0.08em] text-gray-300">{CAT_LABEL[g.category]}</span>
                      <span className="tabular-nums">{moves} moves</span>
                      {g.result !== "*" && <span className="tabular-nums">{g.result}</span>}
                      {g.level && <span>{g.level}</span>}
                      {g.year > 0 && <span className="tabular-nums">{g.year}</span>}
                    </div>
                  </button>
                )
              })}
            </div>
          </div>
          )}

          {tab === "puzzles" && <PuzzleList onStart={handleStartPuzzle} />}
        </div>
      </div>

      <button
        onClick={onToggle}
        className="hidden md:flex shrink-0 w-5 flex-col items-center justify-center hover:bg-gray-50 transition-colors group"
      >
        <span className="font-mono text-sm text-gray-300 group-hover:text-gray-400 select-none leading-none">
          {open ? "◀" : "▶"}
        </span>
      </button>

      {statsOpen && (
        <OpeningStats
          onClose={() => setStatsOpen(false)}
          onSelect={(name) => {
            setSearch(name)
            setFilter("all")
            setStatsOpen(false)
          }}
        />
      )}
    </div>
  )
}
