import { describe, it, expect } from "vitest"
import { fileStem } from "./exporters"

describe("fileStem", () => {
  it("keeps a clean ASCII name unchanged", () => {
    expect(fileStem("Najdorf")).toBe("Najdorf")
  })

  it("replaces spaces and punctuation with single dashes", () => {
    expect(fileStem("My Game!")).toBe("My-Game")
  })

  it("collapses runs of separators into one dash", () => {
    expect(fileStem("a  /  b")).toBe("a-b")
  })

  it("trims leading and trailing dashes", () => {
    expect(fileStem("  spaced  ")).toBe("spaced")
  })

  it("preserves underscores and hyphens (they are word-safe)", () => {
    expect(fileStem("opening_notes-v2")).toBe("opening_notes-v2")
  })

  it("falls back to 'game' when nothing usable remains", () => {
    expect(fileStem("   ")).toBe("game")
    expect(fileStem("!!!")).toBe("game")
  })
})
