import { useEffect, useRef } from "react"
import { useGameStore, type GameState } from "../stores/useGameStore"
import { useBoardStore } from "../stores/useBoardStore"
import { useMetaStore } from "../stores/useMetaStore"
import { useSaveStore } from "../stores/useSaveStore"
import { usePersistenceStore } from "../stores/usePersistenceStore"
import { buildSaveData, commitToLibrary, flashSaved } from "../lib/session"

const DEBOUNCE_MS = 600

// Content changes (moves, annotations, bookmarks, comments, meta) flash the
// indicator. Navigation (historyIndex) is persisted quietly without a flash.
function gameContentSig(s: GameState): string {
  return [
    s.startFen,
    s.fullHistory.length,
    JSON.stringify(s.bookmarks),
    JSON.stringify(s.comments),
    s.orientation,
    s.playSpeed,
  ].join("|")
}

function boardSig(s: { arrows: unknown; highlights: unknown }): string {
  return JSON.stringify(s.arrows) + "|" + JSON.stringify(s.highlights)
}

/**
 * Continuous autosave into the library ("auto a biblioteca"). Subscribes to the
 * game / board / meta stores and, once `active`, upserts the working game on a
 * debounce. Only runs after the initial restore so loading never triggers a save.
 */
export function useAutosave(active: boolean) {
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const pendingFlash = useRef(false)

  useEffect(() => {
    if (!active) return

    const fire = () => {
      if (timer.current) clearTimeout(timer.current)
      timer.current = setTimeout(async () => {
        const flash = pendingFlash.current
        pendingFlash.current = false
        timer.current = undefined
        // Previewing a classic — don't persist until the user actually edits.
        if (useGameStore.getState().transient) {
          useSaveStore.getState().markIdle()
          return
        }
        commitToLibrary()
        try {
          await usePersistenceStore.getState().writeAutosave(buildSaveData())
        } catch {
          /* ignore — autosave is best-effort */
        }
        if (flash) flashSaved()
      }, DEBOUNCE_MS)
    }

    const scheduleContent = () => {
      pendingFlash.current = true
      useSaveStore.getState().markSaving()
      fire()
    }

    const scheduleNav = () => fire()

    let gameSig = gameContentSig(useGameStore.getState())
    let navIdx = useGameStore.getState().historyIndex
    const unsubGame = useGameStore.subscribe((s) => {
      const nextSig = gameContentSig(s)
      if (nextSig !== gameSig) {
        gameSig = nextSig
        navIdx = s.historyIndex
        scheduleContent()
        return
      }
      if (s.historyIndex !== navIdx) {
        navIdx = s.historyIndex
        scheduleNav()
      }
    })

    let bSig = boardSig(useBoardStore.getState())
    const unsubBoard = useBoardStore.subscribe((s) => {
      const next = boardSig(s)
      if (next !== bSig) {
        bSig = next
        scheduleContent()
      }
    })

    let metaSig = useMetaStore.getState().updatedAt
    const unsubMeta = useMetaStore.subscribe((s) => {
      if (s.updatedAt !== metaSig) {
        metaSig = s.updatedAt
        scheduleContent()
      }
    })

    return () => {
      unsubGame()
      unsubBoard()
      unsubMeta()
      if (timer.current) clearTimeout(timer.current)
    }
  }, [active])
}
