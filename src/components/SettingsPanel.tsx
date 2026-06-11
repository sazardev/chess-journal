import DataActions from "./DataActions"
import ThemeToggle from "./ThemeToggle"
import { useConfigStore } from "../stores/useConfigStore"

export default function SettingsPanel({ onClose }: { onClose: () => void }) {
  const sound = useConfigStore((s) => s.sound)
  const setSound = useConfigStore((s) => s.setSound)

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-[#00000033] p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-sm bg-white shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-gray-100 px-4 py-3">
          <span className="font-mono text-[10px] uppercase tracking-[0.15em] text-gray-400">
            Settings
          </span>
          <button
            onClick={onClose}
            className="font-mono text-sm text-gray-400 hover:text-black transition-colors leading-none px-1"
            aria-label="Close"
          >
            ×
          </button>
        </div>

        <p className="px-4 pt-4 pb-2 font-mono text-[9px] uppercase tracking-[0.18em] text-gray-400">
          Preferences
        </p>
        <div className="flex items-center justify-between px-4 pb-1">
          <span className="font-mono text-[11px] text-black">Sound effects</span>
          <button
            onClick={() => setSound(!sound)}
            className={`font-mono text-[9px] uppercase tracking-[0.08em] px-2 py-1 transition-colors ${
              sound ? "bg-black text-white" : "text-gray-400 hover:text-black hover:bg-gray-100"
            }`}
          >
            {sound ? "On" : "Off"}
          </button>
        </div>
        <div className="flex items-center justify-between px-4 pb-1">
          <span className="font-mono text-[11px] text-black">Theme</span>
          <ThemeToggle size="sm" />
        </div>

        <p className="px-4 pt-4 pb-2 font-mono text-[9px] uppercase tracking-[0.18em] text-gray-400">
          Data
        </p>
        <div className="px-4 py-1">
          <DataActions onErased={onClose} />
        </div>
      </div>
    </div>
  )
}
