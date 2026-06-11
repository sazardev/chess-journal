import { useConfigStore } from "../stores/useConfigStore"
import { useAiStore } from "../stores/useAiStore"
import { findModel } from "../lib/ai/runtime"

/**
 * AI-commentary settings (desktop Settings modal + mobile Settings page): the
 * device-capability verdict, the on/off toggle, the local-model download, and the
 * llama-server engine controls. The engine row appears once the model is
 * downloaded; starting it switches commentary to the local LLM.
 */
export default function AiSettings({ size = "sm" }: { size?: "sm" | "md" }) {
  const aiOn = useConfigStore((s) => s.aiCommentary)
  const setAiOn = useConfigStore((s) => s.setAiCommentary)

  const capability = useAiStore((s) => s.capability)
  const modelId = useAiStore((s) => s.modelId)
  const modelState = useAiStore((s) => s.modelState)
  const progress = useAiStore((s) => s.progress)
  const error = useAiStore((s) => s.error)
  const download = useAiStore((s) => s.download)
  const remove = useAiStore((s) => s.remove)

  const engineState = useAiStore((s) => s.engineState)
  const engineProgress = useAiStore((s) => s.engineProgress)
  const engineError = useAiStore((s) => s.engineError)
  const installEngine = useAiStore((s) => s.installEngine)
  const startEngine = useAiStore((s) => s.startEngine)
  const stopEngine = useAiStore((s) => s.stopEngine)

  const model = findModel(modelId)
  const unsupported = capability.tier === "unsupported" || modelState === "unsupported"

  const labelText = size === "md" ? "text-[12px]" : "text-[11px]"
  const btn =
    size === "md"
      ? "font-mono text-[10px] uppercase tracking-[0.08em] px-4 py-2"
      : "font-mono text-[9px] uppercase tracking-[0.08em] px-2 py-1"
  const ghostBtn = `${btn} text-gray-400 transition-colors hover:bg-gray-100 hover:text-black`
  const sizeLabel = model ? `${(model.sizeMB / 1024).toFixed(1)} GB` : ""

  const modelNote =
    modelState === "downloaded"
      ? "Model ready."
      : modelState === "downloading"
        ? "Downloading the model…"
        : modelState === "error"
          ? error ?? "Download failed."
          : `Downloads ~${sizeLabel} on demand; remove anytime to reclaim space.`

  const engineNote =
    engineState === "ready"
      ? "Engine running — AI commentary is active. Open the Game report."
      : engineState === "starting"
        ? "Starting the engine (loads the model)…"
        : engineState === "installing"
          ? "Downloading the llama.cpp runner…"
          : engineState === "error"
            ? engineError ?? "Engine error."
            : engineState === "stopped"
              ? "Start the engine to generate written commentary."
              : "One-time download of the local llama.cpp runner."

  return (
    <>
      <div className="flex items-center justify-between px-4 py-1">
        <span className={`font-mono ${labelText} text-black`}>AI commentary</span>
        <button
          onClick={() => setAiOn(!aiOn)}
          disabled={unsupported}
          className={`${btn} transition-colors disabled:opacity-30 ${
            aiOn ? "bg-black text-white" : "text-gray-400 hover:text-black hover:bg-gray-100"
          }`}
        >
          {aiOn ? "On" : "Off"}
        </button>
      </div>

      <p className="px-4 pb-2 font-mono text-[8px] leading-snug text-gray-400">
        Written commentary from a local model — runs entirely on your device. {capability.reason}
      </p>

      {!unsupported && (
        <div className="mx-4 mb-1 border border-gray-100 p-2">
          <div className="flex items-center justify-between gap-2">
            <span className="min-w-0 truncate font-mono text-[10px] text-black">
              {model?.label ?? "Model"}{" "}
              <span className="text-gray-400">
                · {model?.params} · {sizeLabel}
              </span>
            </span>
            {modelState === "downloaded" ? (
              <button onClick={remove} className={ghostBtn}>
                Remove
              </button>
            ) : modelState === "downloading" ? (
              <span className="font-mono text-[10px] tabular-nums text-black">{Math.round(progress * 100)}%</span>
            ) : (
              <button onClick={download} className={ghostBtn}>
                {modelState === "error" ? "Retry" : "Download"}
              </button>
            )}
          </div>
          {modelState === "downloading" && <Bar value={progress} />}
          <p className="mt-1 font-mono text-[8px] leading-snug text-gray-300">{modelNote}</p>
        </div>
      )}

      {!unsupported && modelState === "downloaded" && (
        <div className="mx-4 mb-1 border border-gray-100 p-2">
          <div className="flex items-center justify-between gap-2">
            <span className="min-w-0 truncate font-mono text-[10px] text-black">
              Engine <span className="text-gray-400">· llama.cpp</span>
            </span>
            {engineState === "absent" || engineState === "error" ? (
              <button onClick={engineState === "error" ? startEngine : installEngine} className={ghostBtn}>
                {engineState === "error" ? "Retry" : "Install"}
              </button>
            ) : engineState === "installing" ? (
              <span className="font-mono text-[10px] tabular-nums text-black">{Math.round(engineProgress * 100)}%</span>
            ) : engineState === "stopped" ? (
              <button onClick={startEngine} className={ghostBtn}>
                Start
              </button>
            ) : engineState === "starting" ? (
              <span className="font-mono text-[9px] uppercase tracking-[0.08em] text-gray-400">Starting…</span>
            ) : (
              <button onClick={stopEngine} className={ghostBtn}>
                Stop
              </button>
            )}
          </div>
          {engineState === "installing" && <Bar value={engineProgress} />}
          <p className="mt-1 font-mono text-[8px] leading-snug text-gray-300">{engineNote}</p>
        </div>
      )}
    </>
  )
}

function Bar({ value }: { value: number }) {
  return (
    <div className="mt-2 h-0.5 w-full bg-gray-100">
      <div className="h-full bg-black transition-all duration-150" style={{ width: `${value * 100}%` }} />
    </div>
  )
}
