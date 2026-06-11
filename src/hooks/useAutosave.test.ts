import { describe, it, expect, beforeEach, afterEach, vi } from "vitest"
import { renderHook, act, cleanup } from "@testing-library/react"
import { useAutosave } from "./useAutosave"
import { useGameStore } from "../stores/useGameStore"
import { useMetaStore } from "../stores/useMetaStore"
import { useBoardStore } from "../stores/useBoardStore"
import { useLibraryStore } from "../stores/useLibraryStore"
import { useSaveStore } from "../stores/useSaveStore"
import { usePersistenceStore } from "../stores/usePersistenceStore"

beforeEach(() => {
  usePersistenceStore.setState({ ready: true, dataDir: "__local__" })
  useLibraryStore.setState({ entries: [] })
  useGameStore.getState().reset()
  useMetaStore.getState().reset()
  useBoardStore.getState().clearAll()
  useSaveStore.setState({ status: "idle", lastSavedAt: null })
})

afterEach(() => {
  cleanup()
  vi.useRealTimers()
})

describe("useAutosave", () => {
  it("debounces a content change into a single library upsert", async () => {
    vi.useFakeTimers()
    renderHook(() => useAutosave(true))

    act(() => {
      useGameStore.getState().makeMoveSan("e4")
    })
    // Immediately marks 'saving'; nothing persisted yet.
    expect(useSaveStore.getState().status).toBe("saving")
    expect(useLibraryStore.getState().entries).toHaveLength(0)

    await act(async () => {
      await vi.advanceTimersByTimeAsync(600)
    })

    expect(useLibraryStore.getState().entries).toHaveLength(1)
    expect(useSaveStore.getState().status).toBe("saved")
  })

  it("does not persist while inactive", async () => {
    vi.useFakeTimers()
    renderHook(() => useAutosave(false))
    act(() => {
      useGameStore.getState().makeMoveSan("e4")
    })
    await act(async () => {
      await vi.advanceTimersByTimeAsync(600)
    })
    expect(useLibraryStore.getState().entries).toHaveLength(0)
  })

  it("skips persisting a transient classic preview", async () => {
    vi.useFakeTimers()
    renderHook(() => useAutosave(true))
    act(() => {
      useGameStore.getState().loadClassic("1. e4 e5 2. Nf3 Nc6") // sets transient
    })
    await act(async () => {
      await vi.advanceTimersByTimeAsync(600)
    })
    expect(useLibraryStore.getState().entries).toHaveLength(0)
    expect(useSaveStore.getState().status).toBe("idle")
  })
})
