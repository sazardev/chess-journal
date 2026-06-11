import { describe, it, expect, beforeEach, afterEach, vi } from "vitest"
import { renderHook, act, cleanup } from "@testing-library/react"
import { useAutoplay } from "./useAutoplay"
import { useGameStore } from "../stores/useGameStore"

const get = () => useGameStore.getState()

beforeEach(() => {
  get().reset()
  for (const san of ["e4", "e5", "Nf3"]) get().makeMoveSan(san)
  get().goToStart()
})

afterEach(() => {
  cleanup()
  vi.useRealTimers()
  useGameStore.setState({ isPlaying: false })
})

describe("useAutoplay", () => {
  it("advances one move per interval tick while playing", () => {
    useGameStore.setState({ isPlaying: true, playSpeed: 50 })
    vi.useFakeTimers()
    renderHook(() => useAutoplay())

    act(() => vi.advanceTimersByTime(50))
    expect(get().historyIndex).toBe(1)
    act(() => vi.advanceTimersByTime(50))
    expect(get().historyIndex).toBe(2)
  })

  it("stops playing once it reaches the end of the line", () => {
    get().goToMove(2) // one move from the end
    useGameStore.setState({ isPlaying: true, playSpeed: 50 })
    vi.useFakeTimers()
    renderHook(() => useAutoplay())

    act(() => vi.advanceTimersByTime(50)) // → index 3 (end)
    expect(get().historyIndex).toBe(3)
    act(() => vi.advanceTimersByTime(50)) // at end → stop
    expect(get().isPlaying).toBe(false)
  })

  it("does nothing when not playing", () => {
    useGameStore.setState({ isPlaying: false })
    vi.useFakeTimers()
    renderHook(() => useAutoplay())
    act(() => vi.advanceTimersByTime(500))
    expect(get().historyIndex).toBe(0)
  })
})
