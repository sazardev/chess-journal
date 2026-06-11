/**
 * The inference boundary for local AI commentary (Tier 1). Everything above this
 * (context assembly, prompts, the Explainer interface, the model-management UI) is
 * runtime-agnostic. The concrete runtime — llama.cpp via a Rust command on
 * desktop, MediaPipe on Android — is wired in the engine spike and registered with
 * `setRuntime()`. Until then `unavailableRuntime` is active and the app falls back
 * to Tier 0 templates everywhere.
 */

export type RuntimeStatus = "no-runtime" | "loading" | "ready" | "error"

/** A system + user message pair for a chat completion. */
export interface ChatMessages {
  system: string
  user: string
}

export interface LocalModelRuntime {
  readonly id: string
  status(): RuntimeStatus
  /**
   * Run the model on a chat prompt, optionally streaming tokens to `onToken`.
   * Resolves with the full text.
   */
  generate(messages: ChatMessages, onToken?: (token: string) => void): Promise<string>
}

/** Default runtime: no engine running. */
export const unavailableRuntime: LocalModelRuntime = {
  id: "none",
  status: () => "no-runtime",
  generate: () => Promise.reject(new Error("Local model runtime is not available")),
}

let activeRuntime: LocalModelRuntime = unavailableRuntime

/** Swap in the real engine (called by the spike once an engine is compiled in). */
export function setRuntime(runtime: LocalModelRuntime): void {
  activeRuntime = runtime
}

export function getRuntime(): LocalModelRuntime {
  return activeRuntime
}

export type ModelFormat = "gguf" | "task"

export interface ModelDescriptor {
  id: string
  label: string
  params: string
  /** Approximate on-disk size, MB — shown before download. */
  sizeMB: number
  format: ModelFormat
  /** Download URL. Finalized with the engine (format must match the runtime). */
  url: string
  fileName: string
  sha256?: string
}

// Default candidates (GGUF, for the likely llama.cpp desktop runtime). URLs/sha
// are confirmed when the engine lands; the download stays gated until then.
export const MODEL_REGISTRY: ModelDescriptor[] = [
  {
    id: "qwen2.5-1.5b-instruct-q4",
    label: "Qwen2.5 1.5B Instruct",
    params: "1.5B",
    sizeMB: 1020,
    format: "gguf",
    url: "https://huggingface.co/Qwen/Qwen2.5-1.5B-Instruct-GGUF/resolve/main/qwen2.5-1.5b-instruct-q4_k_m.gguf",
    fileName: "qwen2.5-1.5b-instruct-q4_k_m.gguf",
  },
  {
    id: "gemma-3-1b-it-q4",
    label: "Gemma 3 1B",
    params: "1B",
    sizeMB: 720,
    format: "gguf",
    url: "https://huggingface.co/google/gemma-3-1b-it-qat-q4_0-gguf/resolve/main/gemma-3-1b-it-q4_0.gguf",
    fileName: "gemma-3-1b-it-q4_0.gguf",
  },
]

export const DEFAULT_MODEL_ID = "qwen2.5-1.5b-instruct-q4"

export function findModel(id: string): ModelDescriptor | undefined {
  return MODEL_REGISTRY.find((m) => m.id === id)
}
