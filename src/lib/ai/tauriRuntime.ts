import { invoke } from "@tauri-apps/api/core"
import { listen } from "@tauri-apps/api/event"
import type { LocalModelRuntime } from "./runtime"

/**
 * Runtime backed by the local llama-server sidecar. `generate` invokes the Rust
 * `ai_generate` command — which streams tokens as `ai-token` events and resolves
 * with the full text. The store only registers this runtime once the server is
 * up, so `status()` reports "ready".
 */
export const tauriRuntime: LocalModelRuntime = {
  id: "llama-server",
  status: () => "ready",
  async generate(messages, onToken) {
    // Tag this request so its tokens don't mix with any other concurrent stream.
    const requestId = crypto.randomUUID()
    const unlisten = await listen<{ id: string; token: string }>("ai-token", (e) => {
      if (e.payload.id === requestId) onToken?.(e.payload.token)
    })
    try {
      return await invoke<string>("ai_generate", {
        requestId,
        system: messages.system,
        user: messages.user,
        maxTokens: 320,
      })
    } finally {
      unlisten()
    }
  },
}
