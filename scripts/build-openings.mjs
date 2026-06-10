#!/usr/bin/env node
// Build src/data/openings.json from the vendored lichess-org/chess-openings TSVs.
// Maps a normalized position key (first 4 FEN fields) -> { eco, name, ply }.
// Run: node scripts/build-openings.mjs

import { readFileSync, writeFileSync, readdirSync } from "node:fs"
import { fileURLToPath } from "node:url"
import { dirname, join } from "node:path"
import { Chess } from "chess.js"

const root = join(dirname(fileURLToPath(import.meta.url)), "..")
const srcDir = join(root, "data", "chess-openings")
const outPath = join(root, "src", "data", "openings.json")

function posKey(fen) {
  return fen.split(" ").slice(0, 4).join(" ")
}

const map = {}
let rows = 0

for (const file of readdirSync(srcDir).filter((f) => f.endsWith(".tsv")).sort()) {
  const lines = readFileSync(join(srcDir, file), "utf-8").split("\n")
  for (const line of lines) {
    const [eco, name, pgn] = line.split("\t")
    if (!eco || !name || !pgn || eco === "eco") continue
    const sans = pgn.replace(/\d+\.(\.\.)?/g, " ").trim().split(/\s+/).filter(Boolean)
    const g = new Chess()
    let ok = true
    for (const san of sans) {
      try {
        g.move(san)
      } catch {
        ok = false
        break
      }
    }
    if (!ok) continue
    const key = posKey(g.fen())
    const ply = sans.length
    // Prefer the deepest line that lands on a given position.
    if (!map[key] || ply > map[key].ply) {
      map[key] = { eco, name, ply }
    }
    rows++
  }
}

writeFileSync(outPath, JSON.stringify(map))
console.log(`Parsed ${rows} lines -> ${Object.keys(map).length} positions`)
console.log(`Wrote ${outPath}`)
