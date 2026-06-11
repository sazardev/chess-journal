import { useEffect } from "react"
import { useConfigStore } from "../stores/useConfigStore"
import { applyTheme } from "../lib/theme"

/**
 * Applies the configured theme to <html>, and — in `system` mode — follows the
 * OS preference live. The store loads the persisted mode asynchronously; this
 * re-applies whenever it changes.
 */
export function useTheme() {
  const theme = useConfigStore((s) => s.theme)

  useEffect(() => {
    applyTheme(theme)
    if (theme !== "system") return
    if (typeof window === "undefined" || typeof window.matchMedia !== "function") return
    const mq = window.matchMedia("(prefers-color-scheme: dark)")
    const onChange = () => applyTheme("system")
    mq.addEventListener("change", onChange)
    return () => mq.removeEventListener("change", onChange)
  }, [theme])
}
