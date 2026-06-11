import { useEffect } from "react"
import Changelog from "./Changelog"
import { useUpdateStore } from "../stores/useUpdateStore"

const REPO = "github.com/sazardev/chess-journal"

export default function AboutModal({ onClose }: { onClose: () => void }) {
  const status = useUpdateStore((s) => s.status)
  const version = useUpdateStore((s) => s.version)
  const progress = useUpdateStore((s) => s.progress)
  const error = useUpdateStore((s) => s.error)
  const check = useUpdateStore((s) => s.check)
  const install = useUpdateStore((s) => s.install)

  // Re-check on open unless an update is already pending/in-flight.
  useEffect(() => {
    if (status === "idle" || status === "uptodate" || status === "error") check()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-[#00000033] p-4"
      onClick={onClose}
    >
      <div
        className="flex max-h-[80vh] w-full max-w-md flex-col bg-white shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-gray-100 px-4 py-3">
          <div className="flex items-center gap-2">
            <svg width="20" height="20" viewBox="0 0 32 32" aria-hidden>
              <rect width="32" height="32" rx="6.5" fill="var(--c-black)" />
              <g fill="var(--c-white)">
                <circle cx="16" cy="7.25" r="1.06" />
                <path d="M16 8.4 C 19.1 10, 20.25 13.5, 17.9 16 L 14.1 16 C 11.75 13.5, 12.9 10, 16 8.4 Z" />
                <rect x="13.95" y="15.8" width="4.1" height="1.45" rx="0.45" />
                <path d="M14.7 17.25 C 12.75 19.75, 11.6 22.6, 11.25 24.75 L 20.75 24.75 C 20.4 22.6, 19.25 19.75, 17.3 17.25 Z" />
                <rect x="10" y="24.7" width="12" height="1.8" rx="0.9" />
              </g>
              <path d="M16.25 9.4 L 18.4 11.6" stroke="var(--c-black)" strokeWidth="0.8" strokeLinecap="round" />
            </svg>
            <div className="flex items-baseline gap-1.5">
              <span className="font-mono text-[11px] uppercase tracking-[0.15em] text-black">Chess Journal</span>
              <span className="font-mono text-[10px] tabular-nums text-gray-400">v{__APP_VERSION__}</span>
            </div>
          </div>
          <button
            onClick={onClose}
            className="font-mono text-sm leading-none text-gray-400 transition-colors hover:text-black"
            aria-label="Close"
          >
            ×
          </button>
        </div>

        {/* Update status */}
        <div className="flex items-center justify-between gap-3 border-b border-gray-100 px-4 py-3">
          <div className="min-w-0">
            {status === "checking" && <p className="font-mono text-[10px] text-gray-400">Checking for updates…</p>}
            {status === "uptodate" && <p className="font-mono text-[10px] text-gray-400">You're on the latest version.</p>}
            {status === "available" && (
              <p className="font-mono text-[10px] text-black">
                Update available — <span className="tabular-nums">v{version}</span>
              </p>
            )}
            {status === "downloading" && (
              <p className="font-mono text-[10px] text-black">
                Downloading… {Math.round(progress * 100)}%
              </p>
            )}
            {status === "error" && (
              <p className="font-mono text-[10px] text-gray-500 truncate">{error || "Update failed"}</p>
            )}
            {(status === "idle") && <p className="font-mono text-[10px] text-gray-400">Check for updates from GitHub.</p>}
          </div>

          <div className="shrink-0">
            {status === "available" ? (
              <button
                onClick={install}
                className="bg-black px-3 py-2 font-mono text-[9px] uppercase tracking-[0.1em] text-white transition-opacity hover:opacity-80"
              >
                Update &amp; restart
              </button>
            ) : status === "downloading" ? (
              <span className="font-mono text-[9px] uppercase tracking-[0.1em] text-gray-300">Updating…</span>
            ) : (
              <button
                onClick={() => check()}
                disabled={status === "checking"}
                className="px-3 py-2 font-mono text-[9px] uppercase tracking-[0.1em] text-gray-400 transition-colors hover:bg-gray-100 hover:text-black disabled:opacity-40"
              >
                Check
              </button>
            )}
          </div>
        </div>

        {status === "downloading" && (
          <div className="h-0.5 w-full bg-gray-100">
            <div className="h-full bg-black transition-all duration-150" style={{ width: `${progress * 100}%` }} />
          </div>
        )}

        {/* Changelog */}
        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3">
          <Changelog />
        </div>

        {/* Footer */}
        <div className="border-t border-gray-100 px-4 py-2">
          <span className="font-mono text-[8px] tracking-[0.05em] text-gray-300">{REPO}</span>
        </div>
      </div>
    </div>
  )
}
