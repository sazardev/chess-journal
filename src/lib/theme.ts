export type ThemeMode = "light" | "dark" | "system"

/** localStorage mirror, read by the pre-paint script in index.html to avoid a
 *  flash of the wrong theme before the app (and its Tauri store) load. */
export const THEME_STORAGE_KEY = "chess-journal-theme"

function systemPrefersDark(): boolean {
  return (
    typeof window !== "undefined" &&
    typeof window.matchMedia === "function" &&
    window.matchMedia("(prefers-color-scheme: dark)").matches
  )
}

/** Resolve a mode to the concrete theme to render. */
export function resolveTheme(mode: ThemeMode): "light" | "dark" {
  if (mode === "system") return systemPrefersDark() ? "dark" : "light"
  return mode
}

/**
 * Apply the resolved theme to <html>, mirror the chosen mode to localStorage,
 * and keep the mobile status-bar colour (`theme-color`) in sync.
 */
export function applyTheme(mode: ThemeMode): void {
  if (typeof document === "undefined") return
  const resolved = resolveTheme(mode)
  document.documentElement.classList.toggle("dark", resolved === "dark")
  try {
    localStorage.setItem(THEME_STORAGE_KEY, mode)
  } catch {
    /* ignore — best-effort mirror */
  }
  const meta = document.querySelector('meta[name="theme-color"]')
  if (meta) meta.setAttribute("content", resolved === "dark" ? "#0c0c0d" : "#ffffff")
}

/** The persisted mode mirror, falling back to "system". Migrates old key on first read. */
export function storedTheme(): ThemeMode {
  try {
    const v = localStorage.getItem(THEME_STORAGE_KEY)
    if (v === "light" || v === "dark" || v === "system") return v
    // Migrate from old key
    const old = localStorage.getItem("chess-mini-theme")
    if (old === "light" || old === "dark" || old === "system") {
      localStorage.setItem(THEME_STORAGE_KEY, old)
      return old
    }
  } catch {
    /* ignore */
  }
  return "system"
}
