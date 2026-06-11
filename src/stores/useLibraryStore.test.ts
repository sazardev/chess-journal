import { describe, it, expect, beforeEach } from "vitest"
import { useLibraryStore } from "./useLibraryStore"
import { usePersistenceStore } from "./usePersistenceStore"
import type { SaveData } from "../types/save"

const get = () => useLibraryStore.getState()

function saveData(name = "Game"): SaveData {
  return {
    version: 1,
    meta: {
      name,
      rating: 0,
      tags: [],
      notes: "",
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z",
    },
    game: {
      fullHistory: [],
      historyIndex: 0,
      orientation: "white",
      bookmarks: [],
      comments: {},
      isPlaying: false,
      playSpeed: 500,
      currentLibraryId: null,
    },
    board: { arrows: [], highlights: {}, annotationHistory: [] },
  }
}

beforeEach(() => {
  usePersistenceStore.setState({ ready: true, dataDir: "__local__" })
  useLibraryStore.setState({ entries: [] })
})

describe("useLibraryStore.addEntry", () => {
  it("adds a new entry and returns its generated id", async () => {
    const id = await get().addEntry(saveData("First"))
    expect(typeof id).toBe("string")
    expect(get().entries).toHaveLength(1)
    expect(get().entries[0].id).toBe(id)
  })

  it("upserts in place when given an existing id (no duplicate)", async () => {
    const id = await get().addEntry(saveData("v1"), "fixed")
    await get().addEntry(saveData("v2"), "fixed")
    expect(get().entries).toHaveLength(1)
    expect(get().entries[0].id).toBe(id)
    expect(get().entries[0].data.meta.name).toBe("v2")
  })

  it("preserves pin and favourite across an upsert", async () => {
    await get().addEntry(saveData("v1"), "fixed")
    await get().togglePin("fixed")
    await get().toggleFavorite("fixed")
    await get().addEntry(saveData("v2"), "fixed")
    expect(get().entries[0].pinned).toBe(true)
    expect(get().entries[0].favorite).toBe(true)
  })

  it("keeps newest entries first and caps the library at 50", async () => {
    for (let i = 0; i < 51; i++) {
      await get().addEntry(saveData(`g${i}`), `id-${i}`)
    }
    expect(get().entries).toHaveLength(50)
    // The most recently added is at the front.
    expect(get().entries[0].id).toBe("id-50")
    // The very first one was trimmed off the tail.
    expect(get().entries.find((e) => e.id === "id-0")).toBeUndefined()
  })
})

describe("useLibraryStore pin/favourite are independent", () => {
  it("toggles pin without affecting favourite and vice versa", async () => {
    await get().addEntry(saveData(), "x")
    await get().togglePin("x")
    expect(get().entries[0].pinned).toBe(true)
    expect(get().entries[0].favorite).toBe(false)
    await get().toggleFavorite("x")
    expect(get().entries[0].pinned).toBe(true)
    expect(get().entries[0].favorite).toBe(true)
    await get().togglePin("x")
    expect(get().entries[0].pinned).toBe(false)
    expect(get().entries[0].favorite).toBe(true)
  })
})

describe("useLibraryStore.updateEntryMeta", () => {
  it("merges metadata into an entry", async () => {
    await get().addEntry(saveData("orig"), "x")
    await get().updateEntryMeta("x", { name: "renamed", rating: 4 })
    expect(get().entries[0].data.meta.name).toBe("renamed")
    expect(get().entries[0].data.meta.rating).toBe(4)
  })
})

describe("useLibraryStore removal", () => {
  it("removes a single entry", async () => {
    await get().addEntry(saveData(), "a")
    await get().addEntry(saveData(), "b")
    await get().removeEntry("a")
    expect(get().entries.map((e) => e.id)).toEqual(["b"])
  })

  it("clears the whole library", async () => {
    await get().addEntry(saveData(), "a")
    await get().clear()
    expect(get().entries).toHaveLength(0)
  })
})
