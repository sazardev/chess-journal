interface Shortcut {
  keys: string
  label: string
}

interface Group {
  title: string
  items: Shortcut[]
}

const GROUPS: Group[] = [
  {
    title: "Navigate",
    items: [
      { keys: "← / →", label: "Previous / next move" },
      { keys: "Ctrl ⌂ / End", label: "Jump to start / end" },
      { keys: "Space", label: "Play / pause" },
      { keys: "Ctrl ⇧ ← / →", label: "Prev / next bookmark" },
    ],
  },
  {
    title: "Edit",
    items: [
      { keys: "Ctrl Z", label: "Undo move" },
      { keys: "Ctrl I", label: "Focus move input" },
      { keys: "Ctrl ⇧ B", label: "Toggle bookmark" },
    ],
  },
  {
    title: "Annotate",
    items: [
      { keys: "Ctrl A", label: "Arrow mode" },
      { keys: "Ctrl M", label: "Mark mode" },
      { keys: "Ctrl X", label: "Clear annotations" },
    ],
  },
  {
    title: "Games",
    items: [
      { keys: "Ctrl S", label: "Save now" },
      { keys: "Ctrl N", label: "New game" },
      { keys: "Ctrl D", label: "Toggle favorite" },
      { keys: "Ctrl L", label: "Toggle library" },
    ],
  },
  {
    title: "View",
    items: [
      { keys: "Ctrl B", label: "Flip board" },
      { keys: "Ctrl ,", label: "Settings" },
      { keys: "?", label: "This panel" },
      { keys: "Esc", label: "Close / deselect" },
    ],
  },
]

export default function ShortcutsOverlay({ onClose }: { onClose: () => void }) {
  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/20 p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg bg-white shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-gray-100 px-4 py-3">
          <span className="font-mono text-[10px] uppercase tracking-[0.15em] text-gray-400">
            Shortcuts
          </span>
          <button
            onClick={onClose}
            className="font-mono text-sm text-gray-400 hover:text-black transition-colors leading-none px-1"
            aria-label="Close"
          >
            ×
          </button>
        </div>

        <div className="grid grid-cols-1 gap-x-6 gap-y-4 px-4 py-4 sm:grid-cols-2">
          {GROUPS.map((group) => (
            <div key={group.title}>
              <p className="mb-1.5 font-mono text-[8px] uppercase tracking-[0.15em] text-gray-400">
                {group.title}
              </p>
              <div className="flex flex-col gap-1">
                {group.items.map((s) => (
                  <div key={s.label} className="flex items-baseline justify-between gap-3">
                    <span className="font-mono text-[10px] text-black truncate">{s.label}</span>
                    <span className="shrink-0 font-mono text-[9px] tracking-[0.05em] text-gray-400 tabular-nums">
                      {s.keys}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
