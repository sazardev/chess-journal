import { tauriAvailable } from "../lib/tauriGate"

let appWindow: {
  minimize: () => Promise<void>
  toggleMaximize: () => Promise<void>
  close: () => Promise<void>
  isMaximized: () => Promise<boolean>
} | null = null

async function getWindow() {
  if (!appWindow && tauriAvailable()) {
    try {
      const { getCurrentWindow } = await import("@tauri-apps/api/window")
      appWindow = getCurrentWindow()
    } catch {
      appWindow = null
    }
  }
  return appWindow
}

export async function minimize() {
  await (await getWindow())?.minimize()
}

export async function toggleMaximize() {
  await (await getWindow())?.toggleMaximize()
}

export async function close() {
  await (await getWindow())?.close()
}

export async function isMaximized(): Promise<boolean> {
  const w = await getWindow()
  if (!w) return false
  return w.isMaximized()
}

export function windowControlsAvailable(): boolean {
  return tauriAvailable()
}
