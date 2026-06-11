import { describe, it, expect, beforeEach } from "vitest"
import { useSaveStore } from "./useSaveStore"

const get = () => useSaveStore.getState()

beforeEach(() => {
  useSaveStore.setState({ status: "idle", lastSavedAt: null })
})

describe("useSaveStore", () => {
  it("starts idle with no save timestamp", () => {
    expect(get().status).toBe("idle")
    expect(get().lastSavedAt).toBeNull()
  })

  it("transitions through saving → saved → idle", () => {
    get().markSaving()
    expect(get().status).toBe("saving")
    get().markSaved()
    expect(get().status).toBe("saved")
    expect(typeof get().lastSavedAt).toBe("number")
    get().markIdle()
    expect(get().status).toBe("idle")
  })

  it("setStatus sets an arbitrary status", () => {
    get().setStatus("saved")
    expect(get().status).toBe("saved")
  })
})
