import { describe, it, expect, beforeEach } from "vitest"
import {
  buildSaveData,
  commitToLibrary,
  newGame,
  toggleCurrentFavorite,
  randomGameName,
} from "./session"
import { loadOpenings } from "./openings"
import { useGameStore, START_FEN } from "../stores/useGameStore"
import { useMetaStore } from "../stores/useMetaStore"
import { useBoardStore } from "../stores/useBoardStore"
import { useLibraryStore } from "../stores/useLibraryStore"
import { useSaveStore } from "../stores/useSaveStore"
import { useAnalysisStore } from "../stores/useAnalysisStore"
import { useEditorStore } from "../stores/useEditorStore"
import { usePersistenceStore } from "../stores/usePersistenceStore"

const CUSTOM_FEN = "7k/8/8/8/8/8/8/K7 w - - 0 1"

beforeEach(() => {
  usePersistenceStore.setState({ ready: true, dataDir: "__local__" })
  useLibraryStore.setState({ entries: [] })
  useGameStore.getState().reset()
  useMetaStore.getState().reset()
  useBoardStore.getState().clearAll()
  useAnalysisStore.getState().clear()
  useEditorStore.getState().exit()
  useSaveStore.setState({ status: "idle", lastSavedAt: null })
})

describe("randomGameName", () => {
  it("returns a non-empty name", () => {
    expect(randomGameName()).toBeTruthy()
    expect(typeof randomGameName()).toBe("string")
  })
})

describe("buildSaveData", () => {
  it("snapshots the working game and board state", () => {
    useGameStore.getState().makeMoveSan("e4")
    useBoardStore.getState().addArrow("e2", "e4")
    const data = buildSaveData()
    expect(data.version).toBe(1)
    expect(data.game.fullHistory).toHaveLength(1)
    expect(data.game.startFen).toBe(START_FEN)
    expect(data.board.arrows).toEqual([{ from: "e2", to: "e4", color: "#757575" }])
  })

  it("auto-tags the result from a checkmating final move", () => {
    for (const san of ["f3", "e5", "g4", "Qh4#"]) useGameStore.getState().makeMoveSan(san)
    expect(buildSaveData().meta.result).toBe("0-1")
  })

  it("does not overwrite a result the user already set", () => {
    useGameStore.getState().makeMoveSan("e4")
    useMetaStore.getState().setResult("1/2-1/2")
    expect(buildSaveData().meta.result).toBe("1/2-1/2")
  })

  it("auto-tags the opening from the standard start once the bank is loaded", async () => {
    await loadOpenings()
    useGameStore.getState().makeMoveSan("e4")
    useGameStore.getState().makeMoveSan("c5")
    const opening = buildSaveData().meta.opening
    expect(opening).toBeDefined()
    expect(opening?.eco).toBe("B20")
    expect(opening?.name).toBe("Sicilian Defense")
    expect(opening?.ply).toBe(2)
  })

  it("skips opening detection for a custom starting position", async () => {
    await loadOpenings()
    useGameStore.getState().setStartPosition(CUSTOM_FEN)
    useGameStore.getState().makeMove("a1", "a2")
    expect(buildSaveData().meta.opening).toBeUndefined()
  })
})

describe("commitToLibrary", () => {
  it("returns null and saves nothing for an empty game from the standard start", () => {
    expect(commitToLibrary()).toBeNull()
    expect(useLibraryStore.getState().entries).toHaveLength(0)
  })

  it("creates a library entry after a move and links it to the game", () => {
    useGameStore.getState().makeMoveSan("e4")
    const id = commitToLibrary()
    expect(id).not.toBeNull()
    expect(useGameStore.getState().currentLibraryId).toBe(id)
    expect(useLibraryStore.getState().entries).toHaveLength(1)
  })

  it("reuses the same id on repeated commits (no duplicate entries)", () => {
    useGameStore.getState().makeMoveSan("e4")
    const id1 = commitToLibrary()
    useGameStore.getState().makeMoveSan("e5")
    const id2 = commitToLibrary()
    expect(id2).toBe(id1)
    expect(useLibraryStore.getState().entries).toHaveLength(1)
  })

  it("saves a custom starting position even with no moves yet", () => {
    useGameStore.getState().setStartPosition(CUSTOM_FEN)
    expect(commitToLibrary()).not.toBeNull()
    expect(useLibraryStore.getState().entries).toHaveLength(1)
  })
})

describe("newGame", () => {
  it("archives the current game, then resets while keeping orientation", () => {
    useGameStore.getState().makeMoveSan("e4")
    useGameStore.getState().flipBoard() // → black
    useMetaStore.getState().setName("Old name")

    newGame()

    expect(useLibraryStore.getState().entries).toHaveLength(1) // archived
    expect(useGameStore.getState().fullHistory).toHaveLength(0) // fresh board
    expect(useGameStore.getState().startFen).toBe(START_FEN)
    expect(useGameStore.getState().currentLibraryId).toBeNull()
    expect(useGameStore.getState().orientation).toBe("black") // preserved
    expect(useSaveStore.getState().status).toBe("idle")
    // Meta was reset → the user's name is gone, a fresh random name assigned.
    expect(useMetaStore.getState().name).not.toBe("Old name")
  })
})

describe("toggleCurrentFavorite", () => {
  it("commits then flags the linked entry as a favourite", () => {
    useGameStore.getState().makeMoveSan("e4")
    toggleCurrentFavorite()
    const entries = useLibraryStore.getState().entries
    expect(entries).toHaveLength(1)
    expect(entries[0].favorite).toBe(true)
  })
})
