import type { LocalModelRuntime, RuntimeStatus, ChatMessages } from "./runtime"

type WorkerMsg =
  | { type: "progress"; loaded: number; total: number }
  | { type: "ready" }
  | { type: "error"; message: string; id?: string }
  | { type: "token"; id: string; token: string }
  | { type: "done"; id: string }

class TransformersRuntime implements LocalModelRuntime {
  readonly id = "transformers-wasm"

  private _status: RuntimeStatus = "no-runtime"
  private worker: Worker | null = null
  private pending = new Map<
    string,
    { onToken?: (t: string) => void; resolve: (s: string) => void; reject: (e: Error) => void; accum: string }
  >()

  status(): RuntimeStatus {
    return this._status
  }

  async load(onProgress?: (progress: number) => void): Promise<void> {
    this._status = "loading"
    this.worker = new Worker(new URL("./transformersWorker.ts", import.meta.url), { type: "module" })

    return new Promise<void>((resolve, reject) => {
      this.worker!.onerror = (e) => {
        this._status = "error"
        reject(new Error(e.message))
      }
      this.worker!.onmessage = ({ data }: MessageEvent<WorkerMsg>) => {
        if (data.type === "ready") {
          this._status = "ready"
          this.worker!.onmessage = ({ data }) => this.dispatch(data as WorkerMsg)
          resolve()
        } else if (data.type === "progress") {
          if (data.total > 0) onProgress?.(data.loaded / data.total)
        } else if (data.type === "error") {
          this._status = "error"
          reject(new Error(data.message))
        }
      }
      this.worker!.postMessage({ type: "load" })
    })
  }

  private dispatch(msg: WorkerMsg) {
    if (msg.type !== "token" && msg.type !== "done" && msg.type !== "error") return
    const id = (msg as { id?: string }).id
    if (!id) return
    const cb = this.pending.get(id)
    if (!cb) return
    if (msg.type === "token") {
      cb.accum += msg.token
      cb.onToken?.(msg.token)
    } else if (msg.type === "done") {
      cb.resolve(cb.accum)
      this.pending.delete(id)
    } else if (msg.type === "error") {
      cb.reject(new Error(msg.message))
      this.pending.delete(id)
    }
  }

  async generate(messages: ChatMessages, onToken?: (t: string) => void): Promise<string> {
    if (this._status !== "ready") throw new Error("Model not ready")
    const id = crypto.randomUUID()
    return new Promise<string>((resolve, reject) => {
      let timer: ReturnType<typeof setTimeout> | null = null
      const done = (fn: () => void) => {
        if (timer) clearTimeout(timer)
        this.pending.delete(id)
        fn()
      }
      this.pending.set(id, {
        onToken,
        resolve: (s) => done(() => resolve(s)),
        reject: (e) => done(() => reject(e)),
        accum: "",
      })
      this.worker!.postMessage({ type: "generate", id, system: messages.system, user: messages.user, maxTokens: 320 })
      // Guard against the worker hanging on low-memory Android devices.
      timer = setTimeout(() => {
        if (this.pending.has(id)) {
          this.pending.get(id)!.reject(new Error("AI timed out — device may need more memory"))
        }
      }, 45_000)
    })
  }

  terminate() {
    this.worker?.terminate()
    this.worker = null
    this._status = "no-runtime"
    for (const cb of this.pending.values()) cb.reject(new Error("Runtime terminated"))
    this.pending.clear()
  }
}

let _instance: TransformersRuntime | null = null

export function getTransformersRuntime(): TransformersRuntime {
  if (!_instance) _instance = new TransformersRuntime()
  return _instance
}

export function terminateTransformersRuntime(): void {
  _instance?.terminate()
  _instance = null
}
