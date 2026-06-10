import type { LibraryEntry } from "../stores/useLibraryStore"

export interface OpeningStat {
  name: string
  eco: string
  games: number
  wins: number
  losses: number
  draws: number
  rated: number // games with both result and your color known
  avgMoves: number // full moves
  avgBook: number // full move where you typically leave theory (0 = unknown)
}

/** Aggregate the library by detected opening for the improvement loop. */
export function aggregateOpenings(entries: LibraryEntry[]): OpeningStat[] {
  const groups = new Map<string, OpeningStat & { _plies: number; _bookPlies: number; _bookN: number }>()

  for (const e of entries) {
    const op = e.data.meta.opening
    const name = op?.name ?? "Unknown"
    const eco = op?.eco ?? "—"
    const plies = e.data.game.fullHistory?.length ?? 0

    let g = groups.get(name)
    if (!g) {
      g = { name, eco, games: 0, wins: 0, losses: 0, draws: 0, rated: 0, avgMoves: 0, avgBook: 0, _plies: 0, _bookPlies: 0, _bookN: 0 }
      groups.set(name, g)
    }

    g.games++
    g._plies += plies
    if (op?.ply) {
      g._bookPlies += op.ply
      g._bookN++
    }

    const result = e.data.meta.result
    const color = e.data.meta.playerColor
    if (color && result && result !== "*") {
      g.rated++
      if (result === "1/2-1/2") {
        g.draws++
      } else {
        const won = (result === "1-0" && color === "white") || (result === "0-1" && color === "black")
        if (won) g.wins++
        else g.losses++
      }
    }
  }

  return [...groups.values()]
    .map((g) => ({
      name: g.name,
      eco: g.eco,
      games: g.games,
      wins: g.wins,
      losses: g.losses,
      draws: g.draws,
      rated: g.rated,
      avgMoves: Math.round(g._plies / g.games / 2),
      avgBook: g._bookN ? Math.round(g._bookPlies / g._bookN / 2) : 0,
    }))
    .sort((a, b) => b.games - a.games)
}
