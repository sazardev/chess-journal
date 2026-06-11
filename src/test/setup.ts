import { beforeEach } from "vitest"

// Each store that persists writes through to localStorage in the test env
// (Tauri APIs are unavailable, so the persistence layer falls back to it).
// Start every test from a clean slate so cross-test state can't leak.
beforeEach(() => {
  try {
    localStorage.clear()
  } catch {
    /* no localStorage in this env — ignore */
  }
})
