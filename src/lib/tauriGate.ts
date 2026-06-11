let available: boolean | null = null
let initPromise: Promise<boolean> | null = null

export function initTauriGate(): Promise<boolean> {
  if (initPromise) return initPromise
  initPromise = (async () => {
    try {
      await import("@tauri-apps/api/core")
      available = true
    } catch {
      available = false
    }
    return available
  })()
  return initPromise
}

export async function isTauri(): Promise<boolean> {
  if (available === null) await initTauriGate()
  return available === true
}

export function tauriAvailable(): boolean {
  return available === true
}
