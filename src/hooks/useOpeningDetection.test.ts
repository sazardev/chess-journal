import { describe, it, expect, beforeEach, afterEach } from "vitest"
import { renderHook, act, cleanup, waitFor } from "@testing-library/react"
import { useOpeningDetection } from "./useOpeningDetection"
import { useGameStore } from "../stores/useGameStore"
import { useOpeningStore } from "../stores/useOpeningStore"
import { loadOpenings } from "../lib/openings"

beforeEach(() => {
  useGameStore.getState().reset()
  useOpeningStore.setState({ current: null })
})

afterEach(cleanup)

describe("useOpeningDetection", () => {
  it("detects the opening of the current position and follows navigation", async () => {
    await loadOpenings() // warm the cache so the effect resolves immediately
    renderHook(() => useOpeningDetection(true))
    await act(async () => {}) // flush the effect's loadOpenings().then(...)

    act(() => {
      useGameStore.getState().makeMoveSan("e4")
      useGameStore.getState().makeMoveSan("c5")
    })

    await waitFor(() => {
      expect(useOpeningStore.getState().current?.name).toBe("Sicilian Defense")
    })
    expect(useOpeningStore.getState().current?.eco).toBe("B20")
  })

  it("clears the detected opening when disabled", async () => {
    useOpeningStore.setState({ current: { eco: "B20", name: "Sicilian Defense", lastBookPly: 2 } })
    renderHook(() => useOpeningDetection(false))
    await waitFor(() => {
      expect(useOpeningStore.getState().current).toBeNull()
    })
  })
})
