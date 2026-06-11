import { describe, it, expect, beforeEach } from "vitest"
import { useMetaStore } from "./useMetaStore"

const get = () => useMetaStore.getState()

beforeEach(() => {
  get().reset()
})

describe("useMetaStore", () => {
  it("starts with sensible defaults", () => {
    expect(get().name).toBeTruthy() // a random game name
    expect(get().rating).toBe(0)
    expect(get().tags).toEqual([])
    expect(get().notes).toBe("")
    expect(get().result).toBe("*")
    expect(get().playerColor).toBeNull()
  })

  it("updates individual fields", () => {
    get().setName("My Game")
    get().setRating(5)
    get().setTags(["tactics", "endgame"])
    get().setResult("1-0")
    get().setPlayerColor("white")
    expect(get().name).toBe("My Game")
    expect(get().rating).toBe(5)
    expect(get().tags).toEqual(["tactics", "endgame"])
    expect(get().result).toBe("1-0")
    expect(get().playerColor).toBe("white")
  })

  it("snapshot reflects the current state", () => {
    get().setName("Snap")
    get().setNotes("hello")
    const snap = get().snapshot()
    expect(snap.name).toBe("Snap")
    expect(snap.notes).toBe("hello")
    expect(snap).toHaveProperty("createdAt")
    expect(snap).toHaveProperty("updatedAt")
  })

  it("loads a saved meta, applying defaults for missing fields", () => {
    get().load({
      name: "Loaded",
      rating: 3,
      tags: ["a"],
      notes: "n",
      createdAt: "2025-01-01T00:00:00.000Z",
      updatedAt: "2025-01-01T00:00:00.000Z",
    })
    expect(get().name).toBe("Loaded")
    expect(get().rating).toBe(3)
    expect(get().result).toBe("*") // defaulted
    expect(get().playerColor).toBeNull() // defaulted
    expect(get().createdAt).toBe("2025-01-01T00:00:00.000Z")
  })

  it("falls back to 'Untitled' when loading a blank name", () => {
    get().load({
      name: "",
      rating: 0,
      tags: [],
      notes: "",
      createdAt: "",
      updatedAt: "",
    })
    expect(get().name).toBe("Untitled")
  })
})
