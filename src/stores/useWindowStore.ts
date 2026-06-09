import { getCurrentWindow } from "@tauri-apps/api/window"

const appWindow = getCurrentWindow()

export function minimize() {
  appWindow.minimize()
}

export async function toggleMaximize() {
  await appWindow.toggleMaximize()
}

export function close() {
  appWindow.close()
}

export async function isMaximized(): Promise<boolean> {
  return appWindow.isMaximized()
}
