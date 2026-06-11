import { invoke } from "@tauri-apps/api/core"
import { listen } from "@tauri-apps/api/event"
import type { LocalModelRuntime } from "./runtime"

export const tauriRuntime: LocalModelRuntime = {
  id: "llama-server",
  status: () => "ready",
  async generate(messages, onToken) {
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
