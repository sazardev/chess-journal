import { SHORTCUT_GROUPS } from "../lib/shortcuts"

/** The grouped key reference, without any modal chrome — reused by the desktop
 * overlay and the mobile Settings page. */
export default function ShortcutsList({ className = "" }: { className?: string }) {
  return (
    <div className={`grid grid-cols-1 gap-x-6 gap-y-4 sm:grid-cols-2 ${className}`}>
      {SHORTCUT_GROUPS.map((group) => (
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
  )
}
