import Changelog from "./Changelog"

const SHORTCUTS: [string, string][] = [
  ["Save now", "Ctrl S"],
  ["New game", "Ctrl N"],
  ["Toggle library", "Ctrl L"],
  ["All shortcuts", "?"],
]

export default function OnboardingModal({ onClose }: { onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-[#0000004d] p-4">
      <div className="flex max-h-[86vh] w-full max-w-md flex-col bg-white shadow-2xl">
        {/* Hero */}
        <div className="flex flex-col items-center gap-2 px-6 pt-7 pb-5 text-center">
          <svg width="56" height="56" viewBox="0 0 32 32" aria-hidden>
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
            <h1 className="font-mono text-[13px] uppercase tracking-[0.18em] text-black">Welcome to Chess Mini</h1>
            <span className="font-mono text-[10px] tabular-nums text-gray-400">v{__APP_VERSION__}</span>
          </div>
          <p className="max-w-xs font-sans text-[12px] leading-relaxed text-gray-500">
            A fast, minimalist desktop app to record, analyze and review your chess games —
            engine analysis, move-quality marks and a searchable library, all saved automatically.
          </p>
        </div>

        {/* Quick shortcuts */}
        <div className="grid grid-cols-2 gap-x-6 gap-y-1 border-y border-gray-100 px-6 py-3">
          {SHORTCUTS.map(([label, keys]) => (
            <div key={label} className="flex items-baseline justify-between gap-2">
              <span className="font-mono text-[10px] text-gray-600">{label}</span>
              <span className="font-mono text-[9px] tracking-[0.05em] text-gray-400 tabular-nums">{keys}</span>
            </div>
          ))}
        </div>

        {/* Changes to consider */}
        <div className="min-h-0 flex-1 overflow-y-auto px-6 py-3">
          <p className="mb-1 font-mono text-[9px] uppercase tracking-[0.15em] text-gray-400">
            Changes to consider
          </p>
          <Changelog />
        </div>

        {/* CTA */}
        <div className="border-t border-gray-100 p-4">
          <button
            onClick={onClose}
            className="w-full bg-black py-3 font-mono text-[11px] uppercase tracking-[0.15em] text-white transition-opacity hover:opacity-80"
            autoFocus
          >
            Start
          </button>
        </div>
      </div>
    </div>
  )
}
