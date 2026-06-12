import { useState } from "react"
import { useConfigStore } from "../stores/useConfigStore"
import { useAiStore } from "../stores/useAiStore"
import { useAiCacheStore } from "../stores/useAiCacheStore"
import { useAnalysisCacheStore } from "../stores/useAnalysisCacheStore"
import { usePlatform } from "../hooks/usePlatform"

/**
 * Minimalist AI-commentary control: a single On/Off switch (assets download +
 * engine start happen automatically with a progress status), plus low-key cache
 * and asset management. No model/engine specifics are shown to the user.
 *
 * On Android uses Transformers.js (WASM) — same click-to-enable flow as desktop.
 */
export default function AiSettings({ size = "sm" }: { size?: "sm" | "md" }) {
  const platform = usePlatform()
  const isAndroid = platform === "android"

  const aiOn = useConfigStore((s) => s.aiCommentary)
  const setAiOn = useConfigStore((s) => s.setAiCommentary)

  const phase = useAiStore((s) => s.phase)
  const step = useAiStore((s) => s.step)
  const progress = useAiStore((s) => s.progress)
  const error = useAiStore((s) => s.error)
  const assetsPresent = useAiStore((s) => s.assetsPresent)
  const removeAssets = useAiStore((s) => s.removeAssets)
  const deviceProfile = useAiStore((s) => s.deviceProfile)

  const [confirmRemove, setConfirmRemove] = useState(false)
  const [cleared, setCleared] = useState(false)

  const unsupported = phase === "unsupported"
  const labelText = size === "md" ? "text-[12px]" : "text-[11px]"
  const btn =
    size === "md"
      ? "font-mono text-[10px] uppercase tracking-[0.08em] px-4 py-2"
      : "font-mono text-[9px] uppercase tracking-[0.08em] px-2 py-1"
  const linkBtn =
    "font-mono text-[8px] uppercase tracking-[0.08em] py-1 text-gray-400 transition-colors hover:text-black"

  const idleDescription = isAndroid
    ? "Written commentary, runs privately on your device using WebAssembly. Downloads ~220 MB the first time."
    : "Written commentary, generated privately on your device. Downloads assets the first time."

  const status = unsupported
    ? "This device can't run on-device AI."
    : phase === "preparing"
      ? step
      : phase === "ready"
        ? "AI ready — commentary is on."
        : phase === "error"
          ? (error ?? "Couldn't set up AI.")
          : aiOn
            ? "Starting AI…"
            : idleDescription

  const showBar = phase === "preparing" && step === "Downloading AI assets…"

  const clearCache = () => {
    useAiCacheStore.getState().clear()
    useAnalysisCacheStore.getState().clear()
    setCleared(true)
    setTimeout(() => setCleared(false), 1500)
  }

  const onRemove = () => {
    if (!confirmRemove) {
      setConfirmRemove(true)
      setTimeout(() => setConfirmRemove(false), 3000)
      return
    }
    setConfirmRemove(false)
    removeAssets()
  }

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

      <div className="px-4 pb-1">
        <p className="font-mono text-[8px] leading-snug text-gray-400">
          {status}
          {phase === "preparing" && progress > 0 && (
            <span className="tabular-nums text-gray-500"> · {Math.round(progress * 100)}%</span>
          )}
        </p>
        {showBar && (
          <div className="mt-1.5 h-0.5 w-full bg-gray-100">
            <div
              className="h-full bg-black transition-all duration-150"
              style={{ width: `${progress * 100}%` }}
            />
          </div>
        )}
        {isAndroid && deviceProfile && !unsupported && phase === "idle" && !aiOn && (
          <p className="mt-0.5 font-mono text-[7px] text-gray-300">
            {deviceProfile.memGb != null ? `${deviceProfile.memGb} GB RAM · ` : ""}
            {deviceProfile.cores} cores · tier: {deviceProfile.tier}
          </p>
        )}
      </div>

      {!unsupported && (
        <div className="flex items-center gap-4 px-4 pb-1">
          <button onClick={clearCache} className={linkBtn}>
            {cleared ? "Cache cleared" : "Clear cache"}
          </button>
          {assetsPresent && !isAndroid && (
            <button onClick={onRemove} className={`${linkBtn} hover:text-black`}>
              {confirmRemove ? "Tap to confirm" : "Remove AI assets"}
            </button>
          )}
        </div>
      )}
    </>
  )
}
