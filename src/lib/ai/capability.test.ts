import { describe, it, expect } from "vitest"
import { detectCapability } from "./capability"

describe("detectCapability", () => {
  it("marks 8GB+ devices supported", () => {
    expect(detectCapability({ deviceMemory: 8, hardwareConcurrency: 8 }).tier).toBe("supported")
  })
  it("marks 4GB devices limited", () => {
    expect(detectCapability({ deviceMemory: 4, hardwareConcurrency: 4 }).tier).toBe("limited")
  })
  it("marks sub-4GB devices unsupported", () => {
    expect(detectCapability({ deviceMemory: 2 }).tier).toBe("unsupported")
  })
  it("returns unknown when memory isn't reported (WebKit)", () => {
    const c = detectCapability({ hardwareConcurrency: 8 })
    expect(c.tier).toBe("unknown")
    expect(c.deviceMemoryGb).toBeNull()
  })
})
