/// <reference lib="webworker" />
import { pipeline, TextStreamer, env } from "@huggingface/transformers"

// Don't look for local filesystem models
env.allowLocalModels = false
// Disable Cache Storage — tauri.localhost is not a secure origin so Cache API fails
env.useBrowserCache = false
// Single thread — no SharedArrayBuffer needed, works on Android WebView
if (env.backends.onnx?.wasm) {
  env.backends.onnx.wasm.numThreads = 1
}

const MODEL_ID = "HuggingFaceTB/SmolLM2-360M-Instruct"

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let generator: any = null

// Aggregate download progress across all files
const fileTotals = new Map<string, number>()
const fileLoaded = new Map<string, number>()

// eslint-disable-next-line @typescript-eslint/no-explicit-any
self.onmessage = async (event: MessageEvent<any>) => {
  const { type } = event.data

  if (type === "load") {
    try {
      generator = await pipeline("text-generation", MODEL_ID, {
        dtype: "q4",
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        progress_callback: (info: any) => {
          if (info.status === "progress" && info.total > 0) {
            const key = info.file ?? info.name ?? "model"
            fileTotals.set(key, info.total)
            fileLoaded.set(key, info.loaded ?? 0)
            const total = [...fileTotals.values()].reduce((a, b) => a + b, 0)
            const loaded = [...fileLoaded.values()].reduce((a, b) => a + b, 0)
            self.postMessage({ type: "progress", loaded, total })
          }
        },
      })
      self.postMessage({ type: "ready" })
    } catch (err) {
      self.postMessage({ type: "error", message: String(err) })
    }
  } else if (type === "generate") {
    if (!generator) {
      self.postMessage({ type: "error", id: event.data.id, message: "Model not loaded" })
      return
    }
    const { id, system, user, maxTokens } = event.data
    try {
      const streamer = new TextStreamer(generator.tokenizer, {
        skip_prompt: true,
        callback_function: (token: string) => {
          self.postMessage({ type: "token", id, token })
        },
      })
      await generator(
        [
          { role: "system", content: system },
          { role: "user", content: user },
        ],
        { max_new_tokens: maxTokens, do_sample: true, temperature: 0.7, streamer },
      )
      self.postMessage({ type: "done", id })
    } catch (err) {
      self.postMessage({ type: "error", id, message: String(err) })
    }
  }
}
