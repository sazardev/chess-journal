#!/usr/bin/env node
// Validate every game in src/data/classics.ts against chess.js.
// Run: node scripts/validate-classics.mjs
import { readFileSync } from "node:fs"
import { Chess } from "chess.js"

const src = readFileSync(new URL("../src/data/classics.ts", import.meta.url), "utf-8")
const games = [...src.matchAll(/id: "([^"]+)"[\s\S]*?moves:\s*\n?\s*"([^"]+)"/g)]

let allOk = true
for (const [, id, moves] of games) {
  const sans = moves.replace(/\d+\.(\.\.)?/g, " ").trim().split(/\s+/).filter(Boolean)
  const g = new Chess()
  let ok = true
  let bad = ""
  for (const s of sans) {
    try {
      g.move(s)
    } catch {
      ok = false
      bad = s
      break
    }
  }
  console.log(`${ok ? "OK  " : "FAIL"} ${id.padEnd(16)} ${sans.length} plies${ok ? "" : ` — illegal: ${bad}`}`)
  if (!ok) allOk = false
}
process.exit(allOk ? 0 : 1)
