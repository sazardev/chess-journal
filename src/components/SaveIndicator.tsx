import { useSaveStore } from "../stores/useSaveStore"

export default function SaveIndicator({ className = "" }: { className?: string }) {
  const status = useSaveStore((s) => s.status)

  return (
    <span
      className={`flex items-center gap-1 font-mono text-[9px] uppercase tracking-[0.12em] select-none transition-opacity duration-300 ${
        status === "idle" ? "opacity-0" : "opacity-100"
      } ${className}`}
      aria-live="polite"
    >
      {status === "saving" ? (
        <>
          <span className="h-1 w-1 shrink-0 rounded-full bg-gray-400 animate-pulse" />
          <span className="text-gray-400">Saving…</span>
        </>
      ) : (
        <>
          <span className="shrink-0 text-black leading-none">✓</span>
          <span className="text-gray-400">Saved</span>
        </>
      )}
    </span>
  )
}
