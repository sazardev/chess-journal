import { useMemo } from "react"
import { useConfigStore } from "../stores/useConfigStore"
import { useAiStore } from "../stores/useAiStore"
import { templateExplainer, createLlmExplainer, type Explainer } from "../lib/ai/explainer"
import { getRuntime } from "../lib/ai/runtime"

/**
 * The active explainer: the local LLM when the user enabled AI commentary and the
 * engine is running, otherwise the Tier 0 template engine. Call sites don't care
 * which — they get the same interface and degrade automatically.
 */
export function useExplainer(): Explainer {
  const aiOn = useConfigStore((s) => s.aiCommentary)
  const engineReady = useAiStore((s) => s.engineState === "ready")
  return useMemo(
    () => (aiOn && engineReady ? createLlmExplainer(getRuntime()) : templateExplainer),
    [aiOn, engineReady],
  )
}
