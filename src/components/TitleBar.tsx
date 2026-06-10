import { useEffect, useState, useCallback, useRef } from "react"
import { minimize, toggleMaximize, close, isMaximized } from "../stores/useWindowStore"
import { useMetaStore } from "../stores/useMetaStore"
import { useGameStore } from "../stores/useGameStore"
import { useLibraryStore } from "../stores/useLibraryStore"
import { useUpdateStore } from "../stores/useUpdateStore"
import { toggleCurrentFavorite } from "../lib/session"
import { useTouch } from "../hooks/useTouch"
import SaveIndicator from "./SaveIndicator"

interface Props {
  onOpenSettings: () => void
  onOpenShortcuts: () => void
  onOpenAbout: () => void
}

export default function TitleBar({ onOpenSettings, onOpenShortcuts, onOpenAbout }: Props) {
  const updateAvailable = useUpdateStore((s) => s.status === "available")
  const [maximized, setMaximized] = useState(false)
  const touch = useTouch()

  const name = useMetaStore((s) => s.name)
  const setName = useMetaStore((s) => s.setName)
  const hasMoves = useGameStore((s) => s.fullHistory.length > 0)
  const currentLibraryId = useGameStore((s) => s.currentLibraryId)
  const isFavorite = useLibraryStore(
    (s) => s.entries.find((e) => e.id === currentLibraryId)?.favorite ?? false,
  )

  const [editing, setEditing] = useState(false)
  const [value, setValue] = useState("")
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    isMaximized().then(setMaximized)
  }, [])

  const handleToggleMaximize = useCallback(async () => {
    await toggleMaximize()
    const m = await isMaximized()
    setMaximized(m)
  }, [])

  const startEdit = useCallback(() => {
    setValue(name === "Untitled" ? "" : name)
    setEditing(true)
    requestAnimationFrame(() => inputRef.current?.focus())
  }, [name])

  const commitEdit = useCallback(() => {
    setName(value.trim() || "Untitled")
    setEditing(false)
  }, [value, setName])

  const winBtn =
    "flex h-8 w-8 md:w-10 items-center justify-center text-gray-400 transition-colors hover:bg-gray-100 hover:text-black"

  return (
    <div
      data-tauri-drag-region
      className="fixed top-0 left-0 right-0 z-50 flex h-[calc(2.25rem+env(safe-area-inset-top))] items-center justify-between bg-white px-2 pt-[env(safe-area-inset-top)] select-none"
    >
      {/* Left: wordmark + version + tools */}
      <div className="flex items-center gap-1 pl-1">
        <span className="hidden sm:inline font-mono text-[10px] tracking-widest uppercase text-gray-400 pr-0.5">
          Chess Mini
        </span>
        <button
          onClick={onOpenAbout}
          title="Version, changelog & updates"
          className="relative flex items-center font-mono text-[9px] tabular-nums text-gray-300 hover:text-black transition-colors px-1"
        >
          v{__APP_VERSION__}
          {updateAvailable && (
            <span className="absolute -right-0 -top-0.5 h-1.5 w-1.5 rounded-full bg-black" />
          )}
        </button>
        <button
          onClick={onOpenSettings}
          title="Settings (Ctrl+,)"
          aria-label="Settings"
          className="flex h-7 w-7 items-center justify-center text-gray-400 hover:text-black transition-colors"
        >
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
            <circle cx="12" cy="12" r="3" />
            <path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M19.1 4.9L17 7M7 17l-2.1 2.1" />
          </svg>
        </button>
        <button
          onClick={onOpenShortcuts}
          title="Shortcuts (?)"
          aria-label="Shortcuts"
          className="flex h-7 w-7 items-center justify-center font-mono text-[12px] text-gray-400 hover:text-black transition-colors"
        >
          ?
        </button>
      </div>

      {/* Center: game name + save status */}
      <div className="flex min-w-0 flex-1 items-center justify-center gap-2 px-2">
        <button
          onClick={() => hasMoves && toggleCurrentFavorite()}
          title="Favorite (Ctrl+D)"
          aria-label="Toggle favorite"
          className={`shrink-0 text-[11px] leading-none transition-colors ${
            !hasMoves
              ? "text-gray-200 cursor-default"
              : isFavorite
                ? "text-black"
                : "text-gray-300 hover:text-black"
          }`}
        >
          {isFavorite ? "♥" : "♡"}
        </button>

        {editing ? (
          <input
            ref={inputRef}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onBlur={commitEdit}
            onKeyDown={(e) => {
              if (e.key === "Enter") commitEdit()
              if (e.key === "Escape") setEditing(false)
            }}
            placeholder="Untitled"
            className="min-w-0 max-w-[40vw] bg-transparent text-center font-mono text-[11px] text-black outline-none placeholder:text-gray-300"
          />
        ) : (
          <button
            onClick={startEdit}
            title="Rename"
            className="min-w-0 truncate font-mono text-[11px] text-gray-500 hover:text-black transition-colors"
          >
            {name || "Untitled"}
          </button>
        )}

        <SaveIndicator className="shrink-0" />
      </div>

      {/* Right: window controls (desktop only) */}
      {touch ? (
        <div className="w-2" aria-hidden />
      ) : (
      <div className="flex items-center">
        <button onClick={minimize} className={winBtn} aria-label="Minimize">
          <svg width="10" height="1" viewBox="0 0 10 1">
            <rect width="10" height="1" fill="currentColor" />
          </svg>
        </button>

        <button onClick={handleToggleMaximize} className={winBtn} aria-label={maximized ? "Restore" : "Maximize"}>
          {maximized ? (
            <svg width="10" height="10" viewBox="0 0 10 10">
              <rect x="2" y="0" width="8" height="8" fill="none" stroke="currentColor" strokeWidth="1" />
              <rect x="0" y="2" width="8" height="8" fill="#fff" stroke="currentColor" strokeWidth="1" />
            </svg>
          ) : (
            <svg width="10" height="10" viewBox="0 0 10 10">
              <rect width="10" height="10" fill="none" stroke="currentColor" strokeWidth="1" />
            </svg>
          )}
        </button>

        <button
          onClick={close}
          className="flex h-8 w-8 md:w-10 items-center justify-center text-gray-400 transition-colors hover:bg-black hover:text-white"
          aria-label="Close"
        >
          <svg width="10" height="10" viewBox="0 0 10 10">
            <line x1="0" y1="0" x2="10" y2="10" stroke="currentColor" strokeWidth="1.2" />
            <line x1="10" y1="0" x2="0" y2="10" stroke="currentColor" strokeWidth="1.2" />
          </svg>
        </button>
      </div>
      )}
    </div>
  )
}
