import { useState } from "react"
import { useMetaStore } from "../stores/useMetaStore"

export default function MetaEditor({ onSave, onClose }: { onSave: () => void; onClose: () => void }) {
  const name = useMetaStore((s) => s.name)
  const rating = useMetaStore((s) => s.rating)
  const tags = useMetaStore((s) => s.tags)
  const notes = useMetaStore((s) => s.notes)
  const createdAt = useMetaStore((s) => s.createdAt)
  const updatedAt = useMetaStore((s) => s.updatedAt)
  const setName = useMetaStore((s) => s.setName)
  const setRating = useMetaStore((s) => s.setRating)
  const setTags = useMetaStore((s) => s.setTags)
  const setNotes = useMetaStore((s) => s.setNotes)

  const [tagsInput, setTagsInput] = useState(tags.join(", "))

  const handleTagsBlur = () => {
    const parsed = tagsInput
      .split(",")
      .map((t) => t.trim())
      .filter(Boolean)
    setTags(parsed)
    setTagsInput(parsed.join(", "))
  }

  const fmt = (iso: string) => {
    if (!iso) return "-"
    const d = new Date(iso)
    return d.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    })
  }

  return (
    <div className="flex flex-col gap-3 px-3 pb-3">
      <div className="flex items-center justify-between">
        <span className="font-mono text-[9px] uppercase tracking-[0.15em] text-gray-400">
          Edit Game
        </span>
        <button
          onClick={() => { onSave(); onClose() }}
          className="font-mono text-[9px] uppercase tracking-[0.15em] text-gray-400 hover:text-black transition-colors"
        >
          Done
        </button>
      </div>

      <label className="flex flex-col gap-1">
        <span className="font-mono text-[8px] uppercase tracking-[0.1em] text-gray-400">Name</span>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Untitled"
          className="bg-transparent font-mono text-[11px] outline-none placeholder:text-gray-300 text-black"
        />
      </label>

      <div className="flex flex-col gap-1">
        <span className="font-mono text-[8px] uppercase tracking-[0.1em] text-gray-400">Rating</span>
        <div className="flex gap-0.5">
          {[1, 2, 3, 4, 5].map((star) => (
            <button
              key={star}
              onClick={() => setRating(rating === star ? 0 : star)}
              className="font-mono text-sm transition-colors text-gray-300 hover:text-black"
            >
              {star <= rating ? "\u2605" : "\u2606"}
            </button>
          ))}
        </div>
      </div>

      <label className="flex flex-col gap-1">
        <span className="font-mono text-[8px] uppercase tracking-[0.1em] text-gray-400">Tags</span>
        <input
          type="text"
          value={tagsInput}
          onChange={(e) => setTagsInput(e.target.value)}
          onBlur={handleTagsBlur}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault()
              ;(e.target as HTMLInputElement).blur()
            }
          }}
          placeholder="opening, tactic, study..."
          className="bg-transparent font-mono text-[11px] outline-none placeholder:text-gray-300 text-black"
        />
        {tags.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {tags.map((tag) => (
              <span
                key={tag}
                className="font-mono text-[8px] px-1.5 py-0.5 bg-gray-100 text-gray-400"
              >
                {tag}
              </span>
            ))}
          </div>
        )}
      </label>

      <label className="flex flex-col gap-1">
        <span className="font-mono text-[8px] uppercase tracking-[0.1em] text-gray-400">Notes</span>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Thoughts, ideas, questions..."
          rows={3}
          className="bg-transparent font-mono text-[10px] leading-snug outline-none placeholder:text-gray-300 text-black resize-none"
        />
      </label>

      <div className="flex flex-col gap-0.5">
        <div className="flex items-center gap-2">
          <span className="font-mono text-[7px] uppercase tracking-[0.1em] text-gray-400 w-14">Created</span>
          <span className="font-mono text-[9px] text-gray-300">{fmt(createdAt)}</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="font-mono text-[7px] uppercase tracking-[0.1em] text-gray-400 w-14">Updated</span>
          <span className="font-mono text-[9px] text-gray-300">{fmt(updatedAt)}</span>
        </div>
      </div>
    </div>
  )
}
