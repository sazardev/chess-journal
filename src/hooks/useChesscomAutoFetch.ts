import { useEffect } from "react"
import { useChesscomStore } from "../stores/useChesscomStore"
import { useLibraryStore } from "../stores/useLibraryStore"
import { fetchArchives, importGames } from "../lib/chesscom"
import type { SaveData } from "../types/save"

export function useChesscomAutoFetch(ready: boolean) {
  useEffect(() => {
    if (!ready) return

    const store = useChesscomStore.getState()
    if (!store.loaded) return

    const autoUsers = store.savedUsers.filter((u) => u.autoFetch)
    if (autoUsers.length === 0) return

    const run = async () => {
      for (const user of autoUsers) {
        try {
          const archives = await fetchArchives(user.username)
          if (archives.length === 0) continue

          // Only import months newer than or equal to the last import month
          const lastDate = new Date(user.lastImportedAt)
          const lastYear = lastDate.getUTCFullYear()
          const lastMonth = lastDate.getUTCMonth() + 1

          const newMonths = archives.filter((a) => {
            if (a.year > lastYear) return true
            if (a.year === lastYear && a.month >= lastMonth) return true
            return false
          })

          if (newMonths.length === 0) continue

          const from = newMonths[newMonths.length - 1]
          const to = newMonths[0]

          const wrapper = async (data: SaveData) => {
            await useLibraryStore.getState().addEntry(data)
          }

          await importGames(
            user.username,
            from.year,
            from.month,
            to.year,
            to.month,
            wrapper,
            () => {}, // silent — no progress UI for auto-fetch
          )

          await store.updateLastImported(user.username)
        } catch {
          // silent — auto-fetch is best-effort
        }
      }
    }

    run()
  }, [ready])
}
