import { describe, it, expect, afterEach, vi } from "vitest"
import { renderHook, cleanup } from "@testing-library/react"
import { usePlatform } from "./usePlatform"
import { useTouch } from "./useTouch"

// Shadow navigator.userAgent with an own property (the real one lives on the
// prototype as a getter); delete it afterwards to restore jsdom's default.
function setUA(ua: string) {
  Object.defineProperty(navigator, "userAgent", { value: ua, configurable: true })
}
function resetUA() {
  // @ts-expect-error deleting the shadowing own property restores the prototype getter
  delete navigator.userAgent
}

afterEach(() => {
  cleanup()
  resetUA()
  vi.unstubAllGlobals()
})

describe("usePlatform", () => {
  it("reports desktop by default (jsdom UA)", () => {
    const { result } = renderHook(() => usePlatform())
    expect(result.current).toBe("desktop")
  })

  it("detects Android from the user agent", () => {
    setUA("Mozilla/5.0 (Linux; Android 14; Pixel 6) AppleWebKit/537.36")
    const { result } = renderHook(() => usePlatform())
    expect(result.current).toBe("android")
  })

  it("detects iOS from the user agent", () => {
    setUA("Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1")
    const { result } = renderHook(() => usePlatform())
    expect(result.current).toBe("ios")
  })
})

describe("useTouch", () => {
  it("is false on a non-touch desktop", () => {
    const { result } = renderHook(() => useTouch())
    expect(result.current).toBe(false)
  })

  it("is true when the pointer is coarse", () => {
    vi.stubGlobal("matchMedia", (q: string) => ({ matches: q.includes("coarse") }))
    const { result } = renderHook(() => useTouch())
    expect(result.current).toBe(true)
  })

  it("is true on a mobile user agent even without matchMedia", () => {
    setUA("Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36")
    const { result } = renderHook(() => useTouch())
    expect(result.current).toBe(true)
  })
})
