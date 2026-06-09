import { useEffect, useRef } from "react"

type ShortcutMap = Record<string, (e: KeyboardEvent) => void>

export function useKeyboard(shortcuts: ShortcutMap, deps: unknown[] = []) {
  const ref = useRef(shortcuts)
  ref.current = shortcuts

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const tag = (document.activeElement?.tagName ?? "").toLowerCase()
      const isInput = tag === "input" || tag === "textarea" || tag === "select"

      const parts: string[] = []
      if (e.ctrlKey || e.metaKey) parts.push("Ctrl")
      if (e.shiftKey) parts.push("Shift")
      if (e.altKey) parts.push("Alt")
      parts.push(e.key)

      if (["Control", "Shift", "Alt", "Meta", "AltGraph"].includes(e.key)) return

      const combo = parts.join("+")

      if (isInput && !["Escape", "Enter", "Ctrl+Shift+B"].includes(combo)) return

      const action = ref.current[combo]
      if (action) {
        e.preventDefault()
        e.stopPropagation()
        action(e)
      }
    }

    window.addEventListener("keydown", handler)
    return () => window.removeEventListener("keydown", handler)
  }, deps)
}
