import { useEffect } from "react"
import { useGameStore } from "../stores/useGameStore"
import { useOpeningStore } from "../stores/useOpeningStore"
import { loadOpenings, detectOpening } from "../lib/openings"

/**
 * Detect the opening of the position currently on the board (up to historyIndex)
 * whenever moves change or you navigate. Lazy-loads the ECO database on first
 * enable. Costs nothing at runtime — a map lookup per ply.
 */
export function useOpeningDetection(enabled: boolean) {
  useEffect(() => {
    if (!enabled) {
      useOpeningStore.getState().setCurrent(null)
      return
    }

    let active = true
    let unsub = () => {}

    loadOpenings().then((map) => {
      if (!active) return
      const recompute = () => {
        const { fullHistory, historyIndex } = useGameStore.getState()
        useOpeningStore
          .getState()
          .setCurrent(detectOpening(fullHistory.slice(0, historyIndex), map))
      }
      recompute()
      unsub = useGameStore.subscribe((s, p) => {
        if (s.fen !== p.fen) recompute()
      })
    })

    return () => {
      active = false
      unsub()
    }
  }, [enabled])
}
