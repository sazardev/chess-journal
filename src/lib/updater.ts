import type { Update } from "@tauri-apps/plugin-updater"

/**
 * Thin wrapper around the Tauri updater. All calls degrade gracefully in the
 * browser (no Tauri runtime) or when the updater isn't configured yet,
 * returning null / no-op instead of throwing.
 */

export async function checkForUpdate(): Promise<Update | null> {
  try {
    const { check } = await import("@tauri-apps/plugin-updater")
    return await check()
  } catch {
    // Not running under Tauri, offline, or updater not configured.
    return null
  }
}

export interface DownloadProgress {
  downloaded: number
  total: number
}

export async function installAndRelaunch(
  update: Update,
  onProgress?: (p: DownloadProgress) => void,
): Promise<void> {
  let downloaded = 0
  let total = 0

  await update.downloadAndInstall((event) => {
    switch (event.event) {
      case "Started":
        total = event.data.contentLength ?? 0
        onProgress?.({ downloaded: 0, total })
        break
      case "Progress":
        downloaded += event.data.chunkLength
        onProgress?.({ downloaded, total })
        break
      case "Finished":
        onProgress?.({ downloaded: total, total })
        break
    }
  })

  const { relaunch } = await import("@tauri-apps/plugin-process")
  await relaunch()
}
