import changelogRaw from "../../CHANGELOG.md?raw"

// Minimal Keep-a-Changelog renderer (markdown → styled plain blocks).
export default function Changelog({ text = changelogRaw }: { text?: string }) {
  const lines = text.split("\n")
  return (
    <div className="flex flex-col gap-0.5 font-mono text-[10px] leading-snug text-gray-600">
      {lines.map((line, i) => {
        if (line.startsWith("## ")) {
          return (
            <p key={i} className="mt-2 text-[11px] font-semibold uppercase tracking-[0.08em] text-black">
              {line.slice(3)}
            </p>
          )
        }
        if (line.startsWith("### ")) {
          return (
            <p key={i} className="mt-1 text-[9px] uppercase tracking-[0.12em] text-gray-400">
              {line.slice(4)}
            </p>
          )
        }
        if (line.startsWith("- ")) {
          return (
            <p key={i} className="pl-2 text-gray-600">
              · {line.slice(2)}
            </p>
          )
        }
        if (line.startsWith("# ")) return null
        if (!line.trim()) return <div key={i} className="h-1" />
        return (
          <p key={i} className="text-gray-400">
            {line}
          </p>
        )
      })}
    </div>
  )
}
