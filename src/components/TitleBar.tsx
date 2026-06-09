import { useEffect, useState, useCallback } from "react"
import { minimize, toggleMaximize, close, isMaximized } from "../stores/useWindowStore"

export default function TitleBar() {
  const [maximized, setMaximized] = useState(false)

  useEffect(() => {
    isMaximized().then(setMaximized)
  }, [])

  const handleToggleMaximize = useCallback(async () => {
    await toggleMaximize()
    const m = await isMaximized()
    setMaximized(m)
  }, [])

  return (
    <div
      data-tauri-drag-region
      className="fixed top-0 left-0 right-0 z-50 flex h-9 items-center justify-between border-b border-border bg-surface px-2 select-none"
    >
      <div className="flex items-center gap-2 pl-2">
        <span className="font-mono text-[10px] tracking-widest uppercase text-text-secondary">
          Chess Mini
        </span>
      </div>

      <div className="flex items-center">
        <button
          onClick={minimize}
          className="flex h-8 w-10 items-center justify-center transition-colors hover:bg-mono-100 dark:hover:bg-mono-800"
          aria-label="Minimize"
        >
          <svg width="10" height="1" viewBox="0 0 10 1">
            <rect width="10" height="1" fill="currentColor" />
          </svg>
        </button>

        <button
          onClick={handleToggleMaximize}
          className="flex h-8 w-10 items-center justify-center transition-colors hover:bg-mono-100 dark:hover:bg-mono-800"
          aria-label={maximized ? "Restore" : "Maximize"}
        >
          {maximized ? (
            <svg width="10" height="10" viewBox="0 0 10 10">
              <rect x="2" y="0" width="8" height="8" fill="none" stroke="currentColor" strokeWidth="1" />
              <rect x="0" y="2" width="8" height="8" fill="var(--surface)" stroke="currentColor" strokeWidth="1" />
            </svg>
          ) : (
            <svg width="10" height="10" viewBox="0 0 10 10">
              <rect width="10" height="10" fill="none" stroke="currentColor" strokeWidth="1" />
            </svg>
          )}
        </button>

        <button
          onClick={close}
          className="flex h-8 w-10 items-center justify-center transition-colors hover:bg-black hover:text-white dark:hover:bg-white dark:hover:text-black"
          aria-label="Close"
        >
          <svg width="10" height="10" viewBox="0 0 10 10">
            <line x1="0" y1="0" x2="10" y2="10" stroke="currentColor" strokeWidth="1.2" />
            <line x1="10" y1="0" x2="0" y2="10" stroke="currentColor" strokeWidth="1.2" />
          </svg>
        </button>
      </div>
    </div>
  )
}
