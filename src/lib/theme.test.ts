import { describe, it, expect, afterEach, vi } from "vitest"
import { resolveTheme, applyTheme, storedTheme, THEME_STORAGE_KEY } from "./theme"

function stubMatchMedia(matches: boolean) {
  vi.stubGlobal("matchMedia", (query: string) => ({
    matches,
    media: query,
    addEventListener: () => {},
    removeEventListener: () => {},
  }))
}

afterEach(() => {
  document.documentElement.classList.remove("dark")
  vi.unstubAllGlobals()
})

describe("resolveTheme", () => {
  it("returns explicit modes unchanged", () => {
    expect(resolveTheme("light")).toBe("light")
    expect(resolveTheme("dark")).toBe("dark")
  })

  it("resolves system via prefers-color-scheme", () => {
    stubMatchMedia(true)
    expect(resolveTheme("system")).toBe("dark")
    stubMatchMedia(false)
    expect(resolveTheme("system")).toBe("light")
  })
})

describe("applyTheme", () => {
  it("adds the dark class and mirrors the mode for dark", () => {
    applyTheme("dark")
    expect(document.documentElement.classList.contains("dark")).toBe(true)
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe("dark")
  })

  it("removes the dark class for light", () => {
    document.documentElement.classList.add("dark")
    applyTheme("light")
    expect(document.documentElement.classList.contains("dark")).toBe(false)
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe("light")
  })

  it("follows the system preference for system mode", () => {
    stubMatchMedia(true)
    applyTheme("system")
    expect(document.documentElement.classList.contains("dark")).toBe(true)
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe("system")
  })

  it("syncs the theme-color meta when present", () => {
    const meta = document.createElement("meta")
    meta.setAttribute("name", "theme-color")
    document.head.appendChild(meta)
    applyTheme("dark")
    expect(meta.getAttribute("content")).toBe("#0c0c0d")
    applyTheme("light")
    expect(meta.getAttribute("content")).toBe("#ffffff")
    meta.remove()
  })
})

describe("storedTheme", () => {
  it("falls back to system when nothing is stored", () => {
    expect(storedTheme()).toBe("system")
  })

  it("reads a persisted mode", () => {
    localStorage.setItem(THEME_STORAGE_KEY, "dark")
    expect(storedTheme()).toBe("dark")
  })

  it("ignores a garbage value", () => {
    localStorage.setItem(THEME_STORAGE_KEY, "neon")
    expect(storedTheme()).toBe("system")
  })
})
