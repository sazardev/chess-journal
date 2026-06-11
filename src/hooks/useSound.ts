import { useEffect } from "react"
import { useGameStore } from "../stores/useGameStore"
import { primeAudio, soundForMove } from "../lib/sound"

/**
 * Plays a move sound whenever the current position changes — covers making a
 * move, stepping/▶ autoplaying through history and jumping to a move. The sound
 * module gates on the persisted `sound` setting, and the autoplay policy keeps
 * it silent until the user's first interaction (so launch-time restore is mute).
 */
export function useSound(): void {
  useEffect(() => {
    primeAudio()
    const unsub = useGameStore.subscribe((state, prev) => {
      if (state.historyIndex === prev.historyIndex) return
      const idx = state.historyIndex
      if (idx <= 0) return // start position — no move to voice
      soundForMove(state.fullHistory[idx - 1])
    })
    return unsub
  }, [])
}
