import { useState } from "react"

export type Platform = "android" | "ios" | "desktop"

function detect(): Platform {
  if (typeof window === "undefined") return "desktop"
  const ua = navigator.userAgent || ""
  if (/Android/i.test(ua)) return "android"
  if (/iPhone|iPad|iPod/i.test(ua)) return "ios"
  return "desktop"
}

/**
 * Returns the current platform. Evaluated once at mount; never changes.
 * On Android (Tauri WebView), `env(safe-area-inset-*)` may be 0 — use
 * platform-specific fallback values for system bar insets.
 */
export function usePlatform(): Platform {
  return useState<Platform>(detect)[0]
}
