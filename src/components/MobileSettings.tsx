import { useEffect } from "react"
import { useUpdateStore } from "../stores/useUpdateStore"
import { useConfigStore } from "../stores/useConfigStore"
import { usePlatform } from "../hooks/usePlatform"
import DataActions from "./DataActions"
import ThemeToggle from "./ThemeToggle"
import AiSettings from "./AiSettings"
import ShortcutsList from "./ShortcutsList"
import Changelog from "./Changelog"

const REPO = "github.com/sazardev/chess-mini"

/** Full-screen mobile Settings page (reachable from the bottom nav). Hosts the
 * pieces that used to live in the title bar on desktop: version/update, data
 * management and the shortcut reference. */
export default function MobileSettings({ onErased }: { onErased?: () => void }) {
  const platform = usePlatform()
  const status = useUpdateStore((s) => s.status)
  const version = useUpdateStore((s) => s.version)
  const progress = useUpdateStore((s) => s.progress)
  const error = useUpdateStore((s) => s.error)
  const check = useUpdateStore((s) => s.check)
  const install = useUpdateStore((s) => s.install)
  const sound = useConfigStore((s) => s.sound)
  const setSound = useConfigStore((s) => s.setSound)

  useEffect(() => {
    if (status === "idle" || status === "uptodate" || status === "error") check()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const section = (title: string) => (
    <p className="px-4 pt-5 pb-2 font-mono text-[9px] uppercase tracking-[0.18em] text-gray-400">
      {title}
    </p>
  )

  // On Android the outer overlay has paddingTop = titleBarH already applied,
  // so this scroll container just needs bottom padding to clear the system nav bar.
  const bottomPad = platform === "android" ? "pb-[4rem]" : "pb-6"

  return (
    <div className={`h-full overflow-y-auto bg-white ${bottomPad}`}>
      {/* Brand + version */}
      <div className="flex items-center gap-3 px-4 pt-5">
        <svg width="28" height="28" viewBox="0 0 32 32" aria-hidden>
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
        <div className="flex items-baseline gap-2">
          <span className="font-mono text-[12px] uppercase tracking-[0.15em] text-black">Chess Mini</span>
          <span className="font-mono text-[11px] tabular-nums text-gray-400">v{__APP_VERSION__}</span>
        </div>
      </div>

      {/* Preferences */}
      {section("Preferences")}
      <div className="flex items-center justify-between px-4 py-1">
        <span className="font-mono text-[12px] text-black">Sound effects</span>
        <button
          onClick={() => setSound(!sound)}
          className={`font-mono text-[10px] uppercase tracking-[0.08em] px-4 py-2 transition-colors ${
            sound ? "bg-black text-white" : "text-gray-400 hover:text-black hover:bg-gray-100"
          }`}
        >
          {sound ? "On" : "Off"}
        </button>
      </div>
      <div className="flex items-center justify-between px-4 py-1">
        <span className="font-mono text-[12px] text-black">Theme</span>
        <ThemeToggle size="md" />
      </div>

      {/* AI */}
      {section("AI")}
      <AiSettings size="md" />

      {/* Update */}
      {section("Updates")}
      <div className="flex items-center justify-between gap-3 px-4">
        <div className="min-w-0">
          {status === "checking" && <p className="font-mono text-[10px] text-gray-400">Checking for updates…</p>}
          {status === "uptodate" && <p className="font-mono text-[10px] text-gray-400">You're on the latest version.</p>}
          {status === "available" && (
            <p className="font-mono text-[10px] text-black">
              Update available — <span className="tabular-nums">v{version}</span>
            </p>
          )}
          {status === "downloading" && (
            <p className="font-mono text-[10px] text-black">Downloading… {Math.round(progress * 100)}%</p>
          )}
          {status === "error" && (
            <p className="font-mono text-[10px] text-gray-500 truncate">{error || "Update failed"}</p>
          )}
          {status === "idle" && <p className="font-mono text-[10px] text-gray-400">Check for updates from GitHub.</p>}
        </div>
        <div className="shrink-0">
          {status === "available" ? (
            <button
              onClick={install}
              className={`bg-black font-mono text-[10px] uppercase tracking-[0.1em] text-white transition-opacity hover:opacity-80 ${
                platform === "android" ? "px-4 py-3" : "px-3 py-2"
              }`}
            >
              Update &amp; restart
            </button>
          ) : status === "downloading" ? (
            <span className="font-mono text-[9px] uppercase tracking-[0.1em] text-gray-300">Updating…</span>
          ) : (
            <button
              onClick={() => check()}
              disabled={status === "checking"}
              className={`font-mono text-[10px] uppercase tracking-[0.1em] text-gray-400 transition-colors hover:bg-gray-100 hover:text-black disabled:opacity-40 ${
                platform === "android" ? "px-4 py-3" : "px-3 py-2"
              }`}
            >
              Check
            </button>
          )}
        </div>
      </div>
      {status === "downloading" && (
        <div className="mx-4 mt-2 h-0.5 bg-gray-100">
          <div className="h-full bg-black transition-all duration-150" style={{ width: `${progress * 100}%` }} />
        </div>
      )}

      {/* Data */}
      {section("Data")}
      <div className="px-4 pb-1">
        <DataActions onErased={onErased} />
      </div>

      {/* Shortcuts */}
      {section("Shortcuts")}
      <ShortcutsList className="px-4" />

      {/* What's new */}
      {section("What's new")}
      <div className="px-4">
        <Changelog />
      </div>

      {/* Footer */}
      <div className="px-4 py-5">
        <span className="font-mono text-[8px] tracking-[0.05em] text-gray-300">{REPO}</span>
      </div>
    </div>
  )
}
