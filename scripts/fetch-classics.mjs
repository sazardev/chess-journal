#!/usr/bin/env node
// Pull real games from the Lichess API into src/data/classics-modern.json.
// They appear under the library's "Classics" tab with opening, ELO, time
// control and result. Run from a network that can reach lichess.org:
//   node scripts/fetch-classics.mjs
// Edit SPECS below to fetch whatever interests you (players, speeds, counts).

import { writeFileSync } from "node:fs"
import { fileURLToPath } from "node:url"
import { dirname, join } from "node:path"
import { Chess } from "chess.js"

const root = join(dirname(fileURLToPath(import.meta.url)), "..")
const out = join(root, "src", "data", "classics-modern.json")

// user = Lichess username · perfType = bullet|blitz|rapid|classical · max = count
const SPECS = [
  { user: "DrNykterstein", perfType: "bullet", max: 50, label: "Carlsen" }, // Magnus Carlsen
  { user: "DrNykterstein", perfType: "blitz", max: 30, label: "Carlsen" },
  { user: "STL_Caruana", perfType: "blitz", max: 15, label: "Caruana" },
  { user: "DanielNaroditsky", perfType: "bullet", max: 15, label: "Naroditsky" },
]
const TOTAL_CAP = 150

const categoryFromTC = (tc) => {
  const base = Number(String(tc || "").split("+")[0]) || 0
  if (!base) return "classical"
  if (base < 180) return "bullet"
  if (base < 480) return "blitz"
  if (base < 1500) return "rapid"
  return "classical"
}
const level = (w, b) => {
  const m = Math.max(w || 0, b || 0)
  if (m >= 2700) return "Super-GM"
  if (m >= 2400) return "Master"
  if (m >= 2000) return "Expert"
  return m ? "Club" : undefined
}
const cleanMoves = (mt) =>
  mt
    .replace(/\{[^}]*\}/g, " ")
    .replace(/\$\d+/g, " ")
    .replace(/\d+\.(\.\.)?/g, " ")
    .replace(/(1-0|0-1|1\/2-1\/2|\*)\s*$/, "")
    .trim()

function parseBlocks(text) {
  return text
    .split(/\n\n(?=\[Event )/)
    .map((chunk) => {
      const tags = {}
      for (const m of chunk.matchAll(/\[(\w+)\s+"([^"]*)"\]/g)) tags[m[1]] = m[2]
      const movetext = chunk
        .split("\n")
        .filter((l) => !l.startsWith("["))
        .join(" ")
        .trim()
      return { tags, movetext }
    })
    .filter((g) => g.movetext)
}

async function main() {
  const seen = new Set()
  const result = []
  for (const spec of SPECS) {
    if (result.length >= TOTAL_CAP) break
    const url = `https://lichess.org/api/games/user/${spec.user}?max=${spec.max}&perfType=${spec.perfType}&opening=true&clocks=false&evals=false`
    process.stdout.write(`Fetching ${spec.user} ${spec.perfType} (max ${spec.max})... `)
    let text
    try {
      const res = await fetch(url, { headers: { Accept: "application/x-chess-pgn" } })
      if (!res.ok) {
        console.log("HTTP " + res.status)
        continue
      }
      text = await res.text()
    } catch (e) {
      console.log("failed: " + e.message)
      continue
    }
    let added = 0
    for (const { tags, movetext } of parseBlocks(text)) {
      if (result.length >= TOTAL_CAP) break
      const id = (tags.Site || "").match(/lichess\.org\/(\w+)/)?.[1] || `g${result.length}`
      if (seen.has(id)) continue
      const sans = cleanMoves(movetext).split(/\s+/).filter(Boolean)
      if (sans.length < 4) continue
      const chess = new Chess()
      let ok = true
      for (const s of sans) {
        try {
          chess.move(s)
        } catch {
          ok = false
          break
        }
      }
      if (!ok) continue
      const we = Number(tags.WhiteElo) || undefined
      const be = Number(tags.BlackElo) || undefined
      seen.add(id)
      result.push({
        id,
        white: tags.White || "?",
        black: tags.Black || "?",
        whiteElo: we,
        blackElo: be,
        event: spec.label || tags.Event || "Lichess",
        year: Number(String(tags.UTCDate || tags.Date || "").slice(0, 4)) || 0,
        result: tags.Result || "*",
        eco: tags.ECO || undefined,
        opening: tags.Opening || undefined,
        timeControl: tags.TimeControl || undefined,
        category: categoryFromTC(tags.TimeControl),
        level: level(we, be),
        tags: [spec.label, (tags.Opening || "").split(":")[0]].filter(Boolean),
        moves: chess.history().join(" "),
      })
      added++
    }
    console.log(`+${added} (total ${result.length})`)
  }
  writeFileSync(out, JSON.stringify(result))
  console.log(`\nWrote ${result.length} games to ${out}`)
  console.log("Rebuild the app (or push to release) to see them under Classics.")
}

main()
