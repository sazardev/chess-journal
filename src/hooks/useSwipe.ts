import { useRef } from "react"

/**
 * Horizontal swipe detection for touch devices. A deliberate flick (fast, mostly
 * horizontal, long enough) fires onLeft / onRight — distinct from a piece drag.
 */
export function useSwipe(onLeft: () => void, onRight: () => void) {
  const start = useRef<{ x: number; y: number; t: number } | null>(null)

  return {
    onTouchStart: (e: React.TouchEvent) => {
      const t = e.changedTouches[0]
      start.current = { x: t.clientX, y: t.clientY, t: Date.now() }
    },
    onTouchEnd: (e: React.TouchEvent) => {
      const s = start.current
      if (!s) return
      start.current = null
      const t = e.changedTouches[0]
      const dx = t.clientX - s.x
      const dy = t.clientY - s.y
      const dt = Date.now() - s.t
      if (dt <= 500 && Math.abs(dx) >= 70 && Math.abs(dx) >= Math.abs(dy) * 2) {
        if (dx < 0) onLeft()
        else onRight()
      }
    },
  }
}
