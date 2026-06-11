import { describe, it, expect, vi, afterEach } from "vitest"
import { renderHook, cleanup } from "@testing-library/react"
import { useSwipe } from "./useSwipe"

afterEach(cleanup)

// Minimal stand-in for a React.TouchEvent carrying one changed touch.
function touch(x: number, y: number) {
  return { changedTouches: [{ clientX: x, clientY: y }] } as unknown as React.TouchEvent
}

function setup() {
  const onLeft = vi.fn()
  const onRight = vi.fn()
  const { result } = renderHook(() => useSwipe(onLeft, onRight))
  return { onLeft, onRight, h: result }
}

describe("useSwipe", () => {
  it("fires onLeft for a fast leftward flick", () => {
    const { onLeft, onRight, h } = setup()
    h.current.onTouchStart(touch(200, 100))
    h.current.onTouchEnd(touch(100, 110)) // dx -100, dy 10
    expect(onLeft).toHaveBeenCalledTimes(1)
    expect(onRight).not.toHaveBeenCalled()
  })

  it("fires onRight for a fast rightward flick", () => {
    const { onLeft, onRight, h } = setup()
    h.current.onTouchStart(touch(100, 100))
    h.current.onTouchEnd(touch(220, 90)) // dx +120
    expect(onRight).toHaveBeenCalledTimes(1)
    expect(onLeft).not.toHaveBeenCalled()
  })

  it("ignores a short movement below the distance threshold", () => {
    const { onLeft, onRight, h } = setup()
    h.current.onTouchStart(touch(100, 100))
    h.current.onTouchEnd(touch(140, 100)) // dx 40 < 70
    expect(onLeft).not.toHaveBeenCalled()
    expect(onRight).not.toHaveBeenCalled()
  })

  it("ignores a mostly-vertical drag", () => {
    const { onLeft, onRight, h } = setup()
    h.current.onTouchStart(touch(100, 100))
    h.current.onTouchEnd(touch(180, 260)) // dx 80 but dy 160 dominates
    expect(onLeft).not.toHaveBeenCalled()
    expect(onRight).not.toHaveBeenCalled()
  })

  it("is a no-op when touchend arrives without a touchstart", () => {
    const { onLeft, onRight, h } = setup()
    h.current.onTouchEnd(touch(100, 100))
    expect(onLeft).not.toHaveBeenCalled()
    expect(onRight).not.toHaveBeenCalled()
  })
})
