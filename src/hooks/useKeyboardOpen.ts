import { useEffect, useState } from "react"

/**
 * True while the on-screen keyboard is visibly occupying the viewport.
 *
 * Tracks `visualViewport` rather than input focus: the system Back button
 * dismisses the keyboard without blurring the focused field, so a focus-based
 * signal gets stuck. Comparing the current viewport height against the tallest
 * height seen recovers correctly whichever way the keyboard is closed.
 */
export function useKeyboardOpen(): boolean {
  const [open, setOpen] = useState(false)

  useEffect(() => {
    const vv = window.visualViewport
    if (!vv) return

    let maxHeight = vv.height
    const update = () => {
      maxHeight = Math.max(maxHeight, vv.height)
      // A real keyboard eats far more than this; small UI shifts won't trip it.
      setOpen(vv.height < maxHeight - 150)
    }

    update()
    vv.addEventListener("resize", update)
    vv.addEventListener("scroll", update)
    return () => {
      vv.removeEventListener("resize", update)
      vv.removeEventListener("scroll", update)
    }
  }, [])

  return open
}
