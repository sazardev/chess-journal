import { Chess } from "chess.js"
import type { Move } from "chess.js"
import type { SaveData, GameResult, PlayerColor } from "../types/save"
import { START_FEN } from "../stores/useGameStore"

const ARCHIVES_URL = "https://api.chess.com/pub/player"

export interface ArchiveInfo {
  url: string
  year: number
  month: number
}

export interface ImportProgress {
  phase: "archives" | "downloading" | "parsing" | "saving" | "done" | "error"
  current: number
  total: number
  message: string
}

function range(
  fromYear: number,
  fromMonth: number,
  toYear: number,
  toMonth: number,
) {
  const start = fromYear * 12 + (fromMonth - 1)
  const end = toYear * 12 + (toMonth - 1)
  if (start > end) return []
  const months: { year: number; month: number }[] = []
  for (let m = start; m <= end; m++) {
    months.push({ year: Math.floor(m / 12), month: (m % 12) + 1 })
  }
  return months
}

function pad(n: number): string {
  return String(n).padStart(2, "0")
}

export async function fetchArchives(
  username: string,
): Promise<ArchiveInfo[]> {
  const res = await fetch(`${ARCHIVES_URL}/${encodeURIComponent(username)}/games/archives`)
  if (!res.ok) {
    if (res.status === 404) throw new Error(`Player "${username}" not found`)
    throw new Error(`Chess.com API error (${res.status})`)
  }
  const data = (await res.json()) as { archives?: string[] }
  const archives: ArchiveInfo[] = []
  for (const url of data.archives ?? []) {
    const match = url.match(/\/(\d{4})\/(\d{2})$/)
    if (match) {
      archives.push({ url, year: +match[1], month: +match[2] })
    }
  }
  archives.sort((a, b) => b.year - a.year || b.month - a.month)
  return archives
}

function splitMultiGamePgn(pgn: string): string[] {
  const chunks = pgn.split(/\n\n(?=\[)/).map((s) => s.trim())
  return chunks.filter((c) => c.length > 0 && c.startsWith("["))
}

function buildSaveDataFromGame(
  g: Chess,
  fullHistory: Move[],
  pgnHeaders: Record<string, string>,
  username: string,
): SaveData {
  const white = pgnHeaders["White"] ?? "Unknown"
  const black = pgnHeaders["Black"] ?? "Unknown"
  const result = (pgnHeaders["Result"] ?? "*") as GameResult
  const whiteUsername = (pgnHeaders["WhiteElo"] ? pgnHeaders["WhiteUsername"] : null) ?? white
  const blackUsername = (pgnHeaders["BlackElo"] ? pgnHeaders["BlackUsername"] : null) ?? black

  let playerColor: PlayerColor = null
  const lower = username.toLowerCase()
  if (whiteUsername.toLowerCase() === lower) playerColor = "white"
  else if (blackUsername.toLowerCase() === lower) playerColor = "black"
  else if (white.toLowerCase() === lower) playerColor = "white"
  else if (black.toLowerCase() === lower) playerColor = "black"

  const startFen = fullHistory.length > 0 ? fullHistory[0].before : g.fen()
  const name = `${white} — ${black}`

  const date = pgnHeaders["UTCDate"]
  const createdAt = date
    ? `${date.slice(0, 4)}-${date.slice(4, 6)}-${date.slice(6, 8)}T12:00:00.000Z`
    : new Date().toISOString()

  const tags: string[] = []
  const event = pgnHeaders["Event"]
  if (event && event !== "Live Chess") tags.push(event)
  const eco = pgnHeaders["ECO"]
  if (eco) tags.push(eco)

  return {
    version: 1,
    meta: {
      name,
      rating: 0,
      tags,
      notes: "",
      createdAt,
      updatedAt: createdAt,
      result: result !== "*" ? result : undefined,
      playerColor,
    },
    game: {
      startFen: startFen !== START_FEN ? startFen : undefined,
      fullHistory,
      historyIndex: fullHistory.length,
      orientation: playerColor === "black" ? "black" : "white",
      bookmarks: [],
      comments: {},
      isPlaying: false,
      playSpeed: 2000,
      currentLibraryId: null,
    },
    board: {
      arrows: [],
      highlights: {},
      annotationHistory: [],
    },
  }
}

function parseSinglePgn(pgn: string): { headers: Record<string, string>; game: Chess; history: Move[] } {
  const g = new Chess()
  g.loadPgn(pgn)

  const headers: Record<string, string> = {}
  const lines = pgn.split("\n")
  for (const line of lines) {
    const match = line.match(/^\[(\w+)\s+"(.*)"\]$/)
    if (match) headers[match[1]] = match[2]
  }

  const history = g.history({ verbose: true })
  return { headers, game: g, history }
}

export async function importGames(
  username: string,
  fromYear: number,
  fromMonth: number,
  toYear: number,
  toMonth: number,
  addEntry: (data: SaveData) => Promise<void>,
  onProgress: (p: ImportProgress) => void,
): Promise<{ imported: number; errors: number }> {
  const months = range(fromYear, fromMonth, toYear, toMonth)
  if (months.length === 0) {
    onProgress({ phase: "error", current: 0, total: 0, message: "Invalid date range" })
    return { imported: 0, errors: 0 }
  }

  onProgress({ phase: "archives", current: 0, total: 0, message: "Fetching game archives..." })
  const allArchives = await fetchArchives(username)

  const available = new Set(
    allArchives.map((a) => `${a.year}-${pad(a.month)}`),
  )
  const toFetch = months.filter((m) =>
    available.has(`${m.year}-${pad(m.month)}`),
  )

  if (toFetch.length === 0) {
    onProgress({ phase: "error", current: 0, total: 0, message: "No games found in date range" })
    return { imported: 0, errors: 0 }
  }

  let imported = 0
  let errors = 0
  const totalMonths = toFetch.length

  for (let i = 0; i < totalMonths; i++) {
    const { year, month } = toFetch[i]
    const url = `${ARCHIVES_URL}/${encodeURIComponent(username)}/games/${year}/${pad(month)}/pgn`

    onProgress({
      phase: "downloading",
      current: i + 1,
      total: totalMonths,
      message: `Downloading ${year}-${pad(month)}...`,
    })

    let pgnText: string
    try {
      const res = await fetch(url)
      if (!res.ok) {
        errors++
        continue
      }
      pgnText = await res.text()
    } catch {
      errors++
      continue
    }

    const chunks = splitMultiGamePgn(pgnText)

    onProgress({
      phase: "parsing",
      current: i + 1,
      total: totalMonths,
      message: `Parsing ${chunks.length} games from ${year}-${pad(month)}...`,
    })

    for (let j = 0; j < chunks.length; j++) {
      try {
        const { game: parsedGame, headers, history } = parseSinglePgn(chunks[j])
        const data = buildSaveDataFromGame(
          parsedGame,
          history,
          headers,
          username,
        )
        if (history.length > 0) {
          onProgress({
            phase: "saving",
            current: i + 1,
            total: totalMonths,
            message: `Saving game ${imported + 1}: ${data.meta.name}`,
          })
          await addEntry(data)
          imported++
        }
      } catch {
        errors++
      }
    }
  }

  onProgress({ phase: "done", current: totalMonths, total: totalMonths, message: `Imported ${imported} games` })
  return { imported, errors }
}

export function getAvailableMonths(
  archives: ArchiveInfo[],
  fromYear: number,
  fromMonth: number,
  toYear: number,
  toMonth: number,
): ArchiveInfo[] {
  const months = range(fromYear, fromMonth, toYear, toMonth)
  const set = new Set(months.map((m) => `${m.year}-${pad(m.month)}`))
  return archives.filter((a) => set.has(`${a.year}-${pad(a.month)}`))
}
