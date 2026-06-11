import { describe, it, expect, beforeEach, afterEach, vi } from "vitest"
import { renderHook, cleanup } from "@testing-library/react"
import { useKeyboard } from "./useKeyboard"

function press(init: KeyboardEventInit) {
  const e = new KeyboardEvent("keydown", { cancelable: true, bubbles: true, ...init })
  window.dispatchEvent(e)
  return e
}

function makeMap() {
  return {
    "Ctrl+s": vi.fn(),
    ArrowRight: vi.fn(),
    Escape: vi.fn(),
    "Ctrl+Shift+B": vi.fn(),
  }
}
type Map = ReturnType<typeof makeMap>

let input: HTMLInputElement

beforeEach(() => {
  input = document.createElement("input")
  document.body.appendChild(input)
})

afterEach(() => {
  cleanup()
  input.remove()
})

describe("useKeyboard (no field focused)", () => {
  let map: Map
  beforeEach(() => {
    map = makeMap()
    renderHook(() => useKeyboard(map))
  })

  it("fires the matching Ctrl combo and prevents default", () => {
    const e = press({ key: "s", ctrlKey: true })
    expect(map["Ctrl+s"]).toHaveBeenCalledTimes(1)
    expect(e.defaultPrevented).toBe(true)
  })

  it("treats metaKey like Ctrl (mac)", () => {
    press({ key: "s", metaKey: true })
    expect(map["Ctrl+s"]).toHaveBeenCalledTimes(1)
  })

  it("fires a bare navigation key", () => {
    press({ key: "ArrowRight" })
    expect(map.ArrowRight).toHaveBeenCalledTimes(1)
  })

  it("ignores modifier-only keypresses", () => {
    press({ key: "Shift", shiftKey: true })
    press({ key: "Control", ctrlKey: true })
    expect(Object.values(map).every((f) => f.mock.calls.length === 0)).toBe(true)
  })

  it("does nothing (and doesn't preventDefault) for an unmapped combo", () => {
    const e = press({ key: "q" })
    expect(e.defaultPrevented).toBe(false)
  })
})

describe("useKeyboard (typing in an input)", () => {
  let map: Map
  beforeEach(() => {
    map = makeMap()
    renderHook(() => useKeyboard(map))
    input.focus()
    expect(document.activeElement).toBe(input)
  })

  it("suppresses ordinary shortcuts while typing", () => {
    press({ key: "ArrowRight" })
    expect(map.ArrowRight).not.toHaveBeenCalled()
  })

  it("still lets Escape through", () => {
    press({ key: "Escape" })
    expect(map.Escape).toHaveBeenCalledTimes(1)
  })

  it("still lets the bookmark chord (Ctrl+Shift+B) through", () => {
    press({ key: "B", ctrlKey: true, shiftKey: true })
    expect(map["Ctrl+Shift+B"]).toHaveBeenCalledTimes(1)
  })
})

describe("useKeyboard cleanup", () => {
  it("removes its listener on unmount", () => {
    const map = makeMap()
    const { unmount } = renderHook(() => useKeyboard(map))
    unmount()
    press({ key: "ArrowRight" })
    expect(map.ArrowRight).not.toHaveBeenCalled()
  })
})
