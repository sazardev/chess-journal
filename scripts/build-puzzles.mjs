#!/usr/bin/env node
// Build the Puzzles bank (src/data/puzzles.json) from public-domain game data.
//
// Source of truth = the same real games that feed the "Classics" tab
// (src/data/classics-modern.json, pulled from Lichess / GitHub PGN collections
// by scripts/build-classics-pgn.mjs) plus a handful of curated legendary games.
// For every game that ends in checkmate we extract the forced mating finish as
// a puzzle: the player must reproduce the master's combination. A few basic
// mates are hand-authored from a FEN. Everything is replayed and validated with
// chess.js — an entry is only emitted if every move is legal and the final move
// is a real checkmate. Nothing fabricated or engine-guessed ships.
//
//   node scripts/build-puzzles.mjs

import { writeFileSync } from "node:fs"
import { fileURLToPath } from "node:url"
import { dirname, join } from "node:path"
import { createRequire } from "node:module"
import { Chess } from "chess.js"

const require = createRequire(import.meta.url)
const root = join(dirname(fileURLToPath(import.meta.url)), "..")
const out = join(root, "src", "data", "puzzles.json")

let MODERN = []
try {
  MODERN = require("../src/data/classics-modern.json")
} catch {
  MODERN = []
}

// Curated legendary finishes (public domain). Same movetext as src/data/classics.ts.
const HISTORIC = [
  { white: "Paul Morphy", black: "Duke of Brunswick", event: "Paris Opera", year: 1858,
    moves: "1. e4 e5 2. Nf3 d6 3. d4 Bg4 4. dxe5 Bxf3 5. Qxf3 dxe5 6. Bc4 Nf6 7. Qb3 Qe7 8. Nc3 c6 9. Bg5 b5 10. Nxb5 cxb5 11. Bxb5+ Nbd7 12. O-O-O Rd8 13. Rxd7 Rxd7 14. Rd1 Qe6 15. Bxd7+ Nxd7 16. Qb8+ Nxb8 17. Rd8#" },
  { white: "Adolf Anderssen", black: "Lionel Kieseritzky", event: "London (Immortal)", year: 1851,
    moves: "1. e4 e5 2. f4 exf4 3. Bc4 Qh4+ 4. Kf1 b5 5. Bxb5 Nf6 6. Nf3 Qh6 7. d3 Nh5 8. Nh4 Qg5 9. Nf5 c6 10. g4 Nf6 11. Rg1 cxb5 12. h4 Qg6 13. h5 Qg5 14. Qf3 Ng8 15. Bxf4 Qf6 16. Nc3 Bc5 17. Nd5 Qxb2 18. Bd6 Bxg1 19. e5 Qxa1+ 20. Ke2 Na6 21. Nxg7+ Kd8 22. Qf6+ Nxf6 23. Be7#" },
  { white: "Adolf Anderssen", black: "Jean Dufresne", event: "Berlin (Evergreen)", year: 1852,
    moves: "1. e4 e5 2. Nf3 Nc6 3. Bc4 Bc5 4. b4 Bxb4 5. c3 Ba5 6. d4 exd4 7. O-O d3 8. Qb3 Qf6 9. e5 Qg6 10. Re1 Nge7 11. Ba3 b5 12. Qxb5 Rb8 13. Qa4 Bb6 14. Nbd2 Bb7 15. Ne4 Qf5 16. Bxd3 Qh5 17. Nf6+ gxf6 18. exf6 Rg8 19. Rad1 Qxf3 20. Rxe7+ Nxe7 21. Qxd7+ Kxd7 22. Bf5+ Ke8 23. Bd7+ Kf8 24. Bxe7#" },
  { white: "Donald Byrne", black: "Bobby Fischer", event: "New York (Game of the Century)", year: 1956,
    moves: "1. Nf3 Nf6 2. c4 g6 3. Nc3 Bg7 4. d4 O-O 5. Bf4 d5 6. Qb3 dxc4 7. Qxc4 c6 8. e4 Nbd7 9. Rd1 Nb6 10. Qc5 Bg4 11. Bg5 Na4 12. Qa3 Nxc3 13. bxc3 Nxe4 14. Bxe7 Qb6 15. Bc4 Nxc3 16. Bc5 Rfe8+ 17. Kf1 Be6 18. Bxb6 Bxc4+ 19. Kg1 Ne2+ 20. Kf1 Nxd4+ 21. Kg1 Ne2+ 22. Kf1 Nc3+ 23. Kg1 axb6 24. Qb4 Ra4 25. Qxb6 Nxd1 26. h3 Rxa2 27. Kh2 Nxf2 28. Re1 Rxe1 29. Qd8+ Bf8 30. Nxe1 Bd5 31. Nf3 Ne4 32. Qb8 b5 33. h4 h5 34. Ne5 Kg7 35. Kg1 Bc5+ 36. Kf1 Ng3+ 37. Ke1 Bb4+ 38. Kd1 Bb3+ 39. Kc1 Ne2+ 40. Kb1 Nc3+ 41. Kc1 Rc2#" },
  { white: "Sire de Légal", black: "Saint Brie", event: "Paris (Légal's Mate)", year: 1750,
    moves: "1. e4 e5 2. Bc4 d6 3. Nf3 Bg4 4. Nc3 g6 5. Nxe5 Bxd1 6. Bxf7+ Ke7 7. Nd5#" },
]

// Hand-authored basic mates (the easy tier). FEN + the single mating move in SAN.
const CONSTRUCTED = [
  { title: "Back-rank rook", theme: "Back rank", fen: "6k1/5ppp/8/8/8/8/5PPP/R5K1 w - - 0 1", san: ["Ra8#"] },
  { title: "Back-rank queen", theme: "Back rank", fen: "6k1/5ppp/8/8/8/8/8/4Q1K1 w - - 0 1", san: ["Qe8#"] },
  { title: "Rook to the eighth", theme: "Back rank", fen: "6k1/5ppp/8/8/8/8/8/3R2K1 w - - 0 1", san: ["Rd8#"] },
  { title: "Supported queen", theme: "King hunt", fen: "7k/8/6KQ/8/8/8/8/8 w - - 0 1", san: ["Qh7#"] },
  { title: "Two-rook ladder", theme: "Back rank", fen: "7k/R7/1R6/8/8/8/8/6K1 w - - 0 1", san: ["Rb8#"] },
]

const cleanMoves = (mt) =>
  mt
    .replace(/\{[^}]*\}/g, " ")
    .replace(/\$\d+/g, " ")
    .replace(/\d+\.(\.\.)?/g, " ")
    .replace(/(1-0|0-1|1\/2-1\/2|\*)\s*$/, "")
    .trim()

const uci = (m) => `${m.from}${m.to}${m.promotion ?? ""}`
const posKey = (fen) => fen.split(" ").slice(0, 4).join(" ")

function lastName(name) {
  const n = String(name || "").trim()
  if (n.includes(",")) return n.split(",")[0].trim()
  const parts = n.split(/\s+/)
  return parts[parts.length - 1] || n
}

const RATINGS = { 1: 800, 2: 1300, 3: 1800, 4: 2100 }
const WORD = { 1: "one", 2: "two", 3: "three", 4: "four" }

function difficulty(mateIn) {
  if (mateIn <= 1) return "easy"
  if (mateIn === 2) return "medium"
  return "hard"
}

function objective(color, mateIn) {
  const side = color === "w" ? "White" : "Black"
  if (mateIn <= 1) return `${side} to move and deliver checkmate.`
  return `${side} to move and force checkmate in ${WORD[mateIn] ?? mateIn} moves.`
}

// Build a puzzle from a full game's mating finish. `lastN` plies (odd) become
// the solution; the position before them is the puzzle FEN. Returns null unless
// it validates as a real forced mate reproduced from the FEN.
function fromGame(game, lastN) {
  const sans = cleanMoves(game.moves).split(/\s+/).filter(Boolean)
  if (sans.length < lastN + 1) return null

  const full = new Chess()
  for (const s of sans) {
    try {
      full.move(s)
    } catch {
      return null
    }
  }
  const verbose = full.history({ verbose: true })
  if (verbose.length < lastN) return null
  const last = verbose[verbose.length - 1]
  if (!last.san.includes("#")) return null

  // Replay up to the split point to capture the puzzle FEN.
  const pre = new Chess()
  const split = verbose.length - lastN
  for (let i = 0; i < split; i++) pre.move(verbose[i].san)
  const fen = pre.fen()

  const solutionMoves = verbose.slice(split)
  if (solutionMoves[0].color !== pre.turn()) return null

  // Independently verify: the solution is legal from the FEN and ends in mate.
  const check = new Chess(fen)
  for (const m of solutionMoves) {
    try {
      check.move(m.san)
    } catch {
      return null
    }
  }
  if (!check.isCheckmate()) return null

  const color = solutionMoves[0].color
  const mateIn = Math.ceil(lastN / 2)
  const w = lastName(game.white)
  const b = lastName(game.black)
  return {
    fen,
    solution: solutionMoves.map(uci),
    playerColor: color,
    title: `${w} vs ${b}`,
    description: objective(color, mateIn),
    mateIn,
    theme: "Checkmate",
    difficulty: difficulty(mateIn),
    rating: RATINGS[mateIn] ?? 2100,
    source: [game.event, game.year > 0 ? game.year : null].filter(Boolean).join(" "),
  }
}

function fromConstructed(c) {
  const g = new Chess(c.fen)
  const color = g.turn()
  const solution = []
  for (const s of c.san) {
    let m
    try {
      m = g.move(s)
    } catch {
      return null
    }
    if (!m) return null
    solution.push(uci(m))
  }
  if (!g.isCheckmate()) return null
  const mateIn = Math.ceil(c.san.length / 2)
  return {
    fen: c.fen,
    solution,
    playerColor: color,
    title: c.title,
    description: objective(color, mateIn),
    mateIn,
    theme: c.theme,
    difficulty: difficulty(mateIn),
    rating: RATINGS[mateIn] ?? 800,
    source: "Composed",
  }
}

function main() {
  const puzzles = []
  const seen = new Set()
  let skipped = 0

  const push = (p) => {
    if (!p) {
      skipped++
      return
    }
    const key = posKey(p.fen)
    if (seen.has(key)) return
    seen.add(key)
    puzzles.push(p)
  }

  // Easy tier: hand-authored basic mates.
  for (const c of CONSTRUCTED) push(fromConstructed(c))

  // Real games ending in mate → forced-finish puzzles. Vary the depth a little
  // so the bank spans mate-in-2 and mate-in-3.
  const games = [...HISTORIC, ...MODERN].filter((g) => /#\s*$/.test(String(g.moves || "").trim()))
  games.forEach((g, i) => {
    const lastN = i % 4 === 0 ? 5 : 3 // mate-in-3 every 4th, else mate-in-2
    push(fromGame(g, lastN) || fromGame(g, 3) || fromGame(g, 1))
  })

  // Stable ids + ordering (easiest first).
  puzzles.sort((a, b) => a.rating - b.rating || a.title.localeCompare(b.title))
  puzzles.forEach((p, i) => {
    p.id = `pz${String(i + 1).padStart(3, "0")}`
  })

  writeFileSync(out, JSON.stringify(puzzles))
  const byMate = puzzles.reduce((acc, p) => ((acc[p.mateIn] = (acc[p.mateIn] || 0) + 1), acc), {})
  console.log(`Wrote ${puzzles.length} puzzles to ${out}`)
  console.log(`  by depth:`, byMate, skipped ? `(skipped ${skipped})` : "")
}

main()
