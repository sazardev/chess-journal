import { useEffect, useState, useCallback, useRef } from "react"
import { minimize, toggleMaximize, close, isMaximized, windowControlsAvailable } from "../stores/useWindowStore"
import { useMetaStore } from "../stores/useMetaStore"
import { useGameStore } from "../stores/useGameStore"
import { useLibraryStore } from "../stores/useLibraryStore"
import { useUpdateStore } from "../stores/useUpdateStore"
import { toggleCurrentFavorite } from "../lib/session"
import { useTouch } from "../hooks/useTouch"
import { usePlatform } from "../hooks/usePlatform"
import SaveIndicator from "./SaveIndicator"

interface Props {
  onOpenSettings: () => void
  onOpenShortcuts: () => void
  onOpenAbout: () => void
  /** When a full-screen mobile section is open, the bar becomes contextual:
      a back arrow + the section name instead of the game title. */
  mobileSection?: "library" | "settings" | null
  onMobileBack?: () => void
}

export default function TitleBar({
  onOpenSettings,
  onOpenShortcuts,
  onOpenAbout,
  mobileSection = null,
  onMobileBack,
}: Props) {
  const updateAvailable = useUpdateStore((s) => s.status === "available")
  const [maximized, setMaximized] = useState(false)
  const touch = useTouch()
  const platform = usePlatform()

  const titleBarH =
    platform === "android"
      ? "h-[calc(2.25rem+2rem)]"
      : "h-[calc(2.25rem+env(safe-area-inset-top))]"
  const titleBarPt =
    platform === "android"
      ? "pt-[2rem]"
      : "pt-[env(safe-area-inset-top)]"

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
    // Window controls only exist on desktop; on touch (Android) the window
    // plugin isn't wired up and isMaximized() rejects with "Plugin window not
    // initialized". Skip it there.
    if (!touch) isMaximized().then(setMaximized)
  }, [touch])

  const handleToggleMaximize = useCallback(async () => {
    await toggleMaximize()
    const m = await isMaximized()
    setMaximized(m)
  }, [])

  const startEdit = useCallback(() => {
    setValue(name)
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
      className={`fixed top-0 left-0 right-0 z-50 flex ${titleBarH} items-center justify-between bg-white px-2 ${titleBarPt} select-none`}
    >
      {mobileSection ? (
        /* Contextual app bar: back arrow + section name (any device). */
        <>
        <div className="flex items-center gap-1.5 pl-1">
          <button
            onClick={onMobileBack}
            aria-label="Back"
            className={`flex items-center justify-center text-gray-500 hover:text-black transition-colors -ml-1 ${
              platform === "android" ? "h-11 w-11" : "h-8 w-8"
            }`}
          >
            <svg width={platform === "android" ? 22 : 18} height={platform === "android" ? 22 : 18} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M15 18l-6-6 6-6" />
            </svg>
          </button>
          <span className={`font-mono uppercase tracking-[0.15em] text-black ${platform === "android" ? "text-[12px]" : "text-[11px]"}`}>
            {mobileSection === "library" ? "Library" : "Settings"}
          </span>
        </div>
        {/* Right: window controls on desktop, spacer on touch */}
        {touch || !windowControlsAvailable() ? (
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
                <rect x="0" y="2" width="8" height="8" fill="var(--c-white)" stroke="currentColor" strokeWidth="1" />
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
        </>
      ) : (
        <>
      {/* Left: wordmark + version + tools.
          On mobile (touch) the version/settings/shortcuts live on the Settings
          page in the bottom nav, so only the wordmark stays here. */}
      <div className="flex items-center gap-1 pl-1">
        <span className="font-mono text-[10px] tracking-widest uppercase text-gray-400 pr-0.5">
          Chess Journal
        </span>
        <div className="hidden md:flex items-center gap-1">
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
              <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
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
      </div>

      {/* Center: game name + save status */}
      <div className="flex min-w-0 flex-1 items-center justify-center gap-2 px-2">
        <button
          onClick={() => hasMoves && toggleCurrentFavorite()}
          title="Favorite (Ctrl+D)"
          aria-label="Toggle favorite"
          className={`shrink-0 flex items-center justify-center leading-none transition-colors ${
            platform === "android" ? "h-9 w-9 text-[14px]" : "h-6 w-6 text-[11px]"
          } ${
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
            className={`min-w-0 max-w-[40vw] bg-transparent text-center font-mono text-black outline-none placeholder:text-gray-300 ${
              platform === "android" ? "text-[12px]" : "text-[11px]"
            }`}
          />
        ) : (
          <button
            onClick={startEdit}
            title="Rename"
            className={`min-w-0 truncate font-mono text-gray-500 hover:text-black transition-colors ${
              platform === "android" ? "text-[12px] py-2" : "text-[11px]"
            }`}
          >
            {name || "Untitled"}
          </button>
        )}

        <SaveIndicator className="shrink-0" />
      </div>

      {/* Right: window controls (desktop only) */}
      {touch || !windowControlsAvailable() ? (
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
              <rect x="0" y="2" width="8" height="8" fill="var(--c-white)" stroke="currentColor" strokeWidth="1" />
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
        </>
      )}
    </div>
  )
}
