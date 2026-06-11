import { describe, it, expect, beforeEach } from "vitest"
import { useBoardStore } from "./useBoardStore"

const get = () => useBoardStore.getState()

beforeEach(() => {
  get().clearAll()
})

describe("useBoardStore arrows", () => {
  it("adds an arrow and records it in history", () => {
    get().addArrow("e2", "e4")
    expect(get().arrows).toHaveLength(1)
    expect(get().annotationHistory).toEqual([{ type: "arrow", from: "e2", to: "e4" }])
  })

  it("ignores a duplicate arrow", () => {
    get().addArrow("e2", "e4")
    get().addArrow("e2", "e4")
    expect(get().arrows).toHaveLength(1)
  })

  it("removes a specific arrow", () => {
    get().addArrow("e2", "e4")
    get().addArrow("d2", "d4")
    get().removeArrow("e2", "e4")
    expect(get().arrows).toEqual([{ from: "d2", to: "d4", color: "#757575" }])
  })

  it("clears all arrows", () => {
    get().addArrow("e2", "e4")
    get().clearArrows()
    expect(get().arrows).toHaveLength(0)
  })
})

describe("useBoardStore highlights", () => {
  it("adds and toggles off a highlight on the same square", () => {
    get().highlightSquare("e4", "#ff0")
    expect(get().highlights).toEqual({ e4: "#ff0" })
    get().highlightSquare("e4", "#ff0")
    expect(get().highlights.e4).toBeUndefined()
  })

  it("clears all highlights", () => {
    get().highlightSquare("e4", "#ff0")
    get().highlightSquare("d4", "#0ff")
    get().clearHighlights()
    expect(get().highlights).toEqual({})
  })
})

describe("useBoardStore annotation mode", () => {
  it("toggles a mode on and back off", () => {
    get().toggleAnnotationMode("arrow")
    expect(get().annotationMode).toBe("arrow")
    get().toggleAnnotationMode("arrow")
    expect(get().annotationMode).toBe("none")
  })

  it("switches between modes", () => {
    get().toggleAnnotationMode("arrow")
    get().toggleAnnotationMode("highlight")
    expect(get().annotationMode).toBe("highlight")
  })

  it("cancels annotation mode", () => {
    get().toggleAnnotationMode("arrow")
    get().cancelAnnotation()
    expect(get().annotationMode).toBe("none")
  })
})

describe("useBoardStore undo", () => {
  it("undoes the most recent annotation, newest first", () => {
    get().addArrow("e2", "e4")
    get().highlightSquare("d4", "#ff0")
    get().undoLastAnnotation() // removes the highlight
    expect(get().highlights).toEqual({})
    expect(get().arrows).toHaveLength(1)
    get().undoLastAnnotation() // removes the arrow
    expect(get().arrows).toHaveLength(0)
    expect(get().annotationHistory).toHaveLength(0)
  })

  it("is a no-op when there is nothing to undo", () => {
    get().undoLastAnnotation()
    expect(get().annotationHistory).toHaveLength(0)
  })
})

describe("useBoardStore clearAll", () => {
  it("resets every annotation field", () => {
    get().addArrow("e2", "e4")
    get().highlightSquare("d4", "#ff0")
    get().selectSquare("a1")
    get().toggleAnnotationMode("arrow")
    get().clearAll()
    expect(get()).toMatchObject({
      arrows: [],
      highlights: {},
      annotationMode: "none",
      selectedSquare: null,
      annotationHistory: [],
    })
  })
})
