import { useConfigStore } from "../stores/useConfigStore"
import type { ThemeMode } from "../lib/theme"

const MODES: { id: ThemeMode; label: string }[] = [
  { id: "light", label: "Light" },
  { id: "dark", label: "Dark" },
  { id: "system", label: "Auto" },
]

/** Segmented Light / Dark / Auto control, matching the On/Off toggle style. */
export default function ThemeToggle({ size = "sm" }: { size?: "sm" | "md" }) {
  const theme = useConfigStore((s) => s.theme)
  const setTheme = useConfigStore((s) => s.setTheme)

  const pad = size === "md" ? "px-3 py-2" : "px-2 py-1"
  const text = size === "md" ? "text-[10px]" : "text-[9px]"

  return (
    <div className="flex">
      {MODES.map((m) => (
        <button
          key={m.id}
          onClick={() => setTheme(m.id)}
          aria-pressed={theme === m.id}
          className={`font-mono ${text} uppercase tracking-[0.08em] ${pad} transition-colors ${
            theme === m.id
              ? "bg-black text-white"
              : "text-gray-400 hover:text-black hover:bg-gray-100"
          }`}
        >
          {m.label}
        </button>
      ))}
    </div>
  )
}
