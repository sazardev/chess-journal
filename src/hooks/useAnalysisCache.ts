import { useEffect } from "react"
import { useGameStore } from "../stores/useGameStore"
import { useConfigStore } from "../stores/useConfigStore"
import { useAnalysisStore } from "../stores/useAnalysisStore"
import { useAnalysisCacheStore, analysisCacheKey } from "../stores/useAnalysisCacheStore"

/**
 * Restore a game's cached analysis when it's opened (or when the engine preset
 * changes), so marks/explanations show instantly and re-running "Analyze game"
 * is a no-op. Only restores an exact (preset + start + moves) match.
 */
export function useAnalysisCache() {
  const loaded = useAnalysisCacheStore((s) => s.loaded)
  const fullHistory = useGameStore((s) => s.fullHistory)
  const startFen = useGameStore((s) => s.startFen)
  const preset = useConfigStore((s) => s.engineConfig.preset)

  useEffect(() => {
    if (!loaded || fullHistory.length === 0) return
    const key = analysisCacheKey(
      preset,
      startFen,
      fullHistory.map((m) => m.lan),
    )
    const cached = useAnalysisCacheStore.getState().get(key)
    if (cached) {
      useAnalysisStore.getState().load(cached)
      useAnalysisStore.getState().setMark(true)
    }
  }, [loaded, fullHistory, startFen, preset])
}
