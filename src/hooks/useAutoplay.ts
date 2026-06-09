import { useEffect } from "react"
import { useGameStore } from "../stores/useGameStore"

export function useAutoplay() {
  const isPlaying = useGameStore((s) => s.isPlaying)
  const playSpeed = useGameStore((s) => s.playSpeed)

  useEffect(() => {
    if (!isPlaying) return

    const id = setInterval(() => {
      const state = useGameStore.getState()
      if (state.historyIndex >= state.history.length || state.isGameOver) {
        useGameStore.setState({ isPlaying: false })
        return
      }
      state.goForward()
    }, playSpeed)

    return () => clearInterval(id)
  }, [isPlaying, playSpeed])
}
