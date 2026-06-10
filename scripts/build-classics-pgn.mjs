#!/usr/bin/env node
// Build a large, varied local game bank from public PGN collections on GitHub
// (rozim/ChessData · PgnMentor + niklasf/python-chess famous games) into
// src/data/classics-modern.json. Opening names are derived from the bundled
// ECO base. No opening filtering — we sample broadly for variety.
//   node scripts/build-classics-pgn.mjs

import { writeFileSync } from "node:fs"
import { fileURLToPath } from "node:url"
import { dirname, join } from "node:path"
import { createRequire } from "node:module"
import { Chess } from "chess.js"

const require = createRequire(import.meta.url)
const OPENINGS = require("../src/data/openings.json")
const root = join(dirname(fileURLToPath(import.meta.url)), "..")
const out = join(root, "src", "data", "classics-modern.json")

const PM = "https://raw.githubusercontent.com/rozim/ChessData/master/PgnMentor"
const PC = "https://raw.githubusercontent.com/niklasf/python-chess/master/data/pgn"

// Legends across every era + today's elite, evenly sampled across each career.
const PLAYERS = [
  "Morphy", "Anderssen", "Steinitz", "Zukertort", "Chigorin", "Tarrasch", "Pillsbury",
  "Lasker", "Schlechter", "Marshall", "Capablanca", "Rubinstein", "Nimzowitsch", "Reti",
  "Alekhine", "Euwe", "Spielmann", "Bogoljubov", "Botvinnik", "Keres", "Smyslov",
  "Bronstein", "Najdorf", "Geller", "Stein", "Petrosian", "Spassky", "Korchnoi",
  "Larsen", "Portisch", "Polugaevsky", "Fischer", "Karpov", "Kasparov", "Short",
  "Anand", "Kramnik", "Ivanchuk", "Shirov", "Gelfand", "Leko", "Adams", "Svidler",
  "Topalov", "Aronian", "Grischuk", "Mamedyarov", "Radjabov", "Karjakin", "Nakamura",
  "PolgarJ", "Caruana", "So", "Giri", "Carlsen", "Nepomniachtchi", "Ding", "Duda",
  "Rapport", "Firouzja",
]
const PER_PLAYER = 16
const TOTAL_CAP = 1000

// First-name aliases so searching "magnus", "bobby", "garry"… finds the games.
const ALIASES = {
  Morphy: "Paul", Steinitz: "Wilhelm", Lasker: "Emanuel", Capablanca: "Jose Raul",
  Alekhine: "Alexander", Euwe: "Max", Botvinnik: "Mikhail", Smyslov: "Vasily",
  Tal: "Mikhail", Petrosian: "Tigran", Spassky: "Boris", Fischer: "Bobby Robert",
  Karpov: "Anatoly", Kasparov: "Garry", Kramnik: "Vladimir", Anand: "Viswanathan Vishy",
  Carlsen: "Magnus", Caruana: "Fabiano", Nakamura: "Hikaru", Aronian: "Levon",
  Nepomniachtchi: "Ian Nepo", Ding: "Liren", Firouzja: "Alireza", Ivanchuk: "Vassily",
  Korchnoi: "Viktor", Bronstein: "David", Rubinstein: "Akiba", Reti: "Richard",
  Keres: "Paul", Marshall: "Frank", Pillsbury: "Harry", Najdorf: "Miguel",
  Geller: "Efim", Stein: "Leonid", Larsen: "Bent", Portisch: "Lajos",
  Polugaevsky: "Lev", Short: "Nigel", Gelfand: "Boris", Leko: "Peter", Adams: "Michael",
  Svidler: "Peter", Topalov: "Veselin", Grischuk: "Alexander", Mamedyarov: "Shakhriyar",
  Radjabov: "Teimour", Karjakin: "Sergey", PolgarJ: "Judit Polgar", So: "Wesley",
  Giri: "Anish", Duda: "Jan-Krzysztof", Rapport: "Richard", Chigorin: "Mikhail",
  Tarrasch: "Siegbert", Zukertort: "Johannes", Schlechter: "Carl", Spielmann: "Rudolf",
  Bogoljubov: "Efim", Anderssen: "Adolf",
}

const FAMOUS = [
  { url: `${PC}/kasparov-deep-blue-1997.pgn`, label: "Kasparov–Deep Blue", max: 6 },
  { url: `${PC}/nepomniachtchi-liren-game1.pgn`, label: "WCC 2023", max: 2 },
  { url: `${PC}/molinari-bordais-1979.pgn`, label: "Famous", max: 1 },
  { url: `${PC}/anastasian-lewis.pgn`, label: "Famous", max: 1 },
]

const posKey = (fen) => fen.split(" ").slice(0, 4).join(" ")
const cleanMoves = (mt) =>
  mt
    .replace(/\{[^}]*\}/g, " ")
    .replace(/\$\d+/g, " ")
    .replace(/\d+\.(\.\.)?/g, " ")
    .replace(/(1-0|0-1|1\/2-1\/2|\*)\s*$/, "")
    .trim()

function parseGames(text) {
  return text
    .replace(/\r/g, "")
    .split(/\n\n(?=\[Event )/)
    .map((chunk) => {
      const tags = {}
      for (const m of chunk.matchAll(/\[(\w+)\s+"([^"]*)"\]/g)) tags[m[1]] = m[2]
      const movetext = chunk
        .split("\n")
        .filter((l) => !l.startsWith("[") && l.trim())
        .join(" ")
        .trim()
      return { tags, movetext }
    })
    .filter((g) => g.movetext && g.tags.White)
}

function buildEntry(tags, movetext, label, famous) {
  const sans = cleanMoves(movetext).split(/\s+/).filter(Boolean)
  if (sans.length < 6) return null
  const g = new Chess()
  let opening = null
  for (let i = 0; i < sans.length; i++) {
    try {
      g.move(sans[i])
    } catch {
      return null
    }
    const hit = OPENINGS[posKey(g.fen())]
    if (hit) opening = { eco: hit.eco, name: hit.name }
  }
  const we = Number(tags.WhiteElo) || undefined
  const be = Number(tags.BlackElo) || undefined
  const m = Math.max(we || 0, be || 0)
  const level = famous
    ? "Legendary"
    : m >= 2700
      ? "Super-GM"
      : m >= 2400
        ? "Master"
        : m
          ? "Expert"
          : "Classic"
  const id = `${label}-${(tags.Date || "").replace(/\./g, "")}-${tags.White}-${tags.Black}`
    .replace(/[^\w-]+/g, "")
    .slice(0, 70)
  return {
    id,
    white: tags.White || "?",
    black: tags.Black || "?",
    whiteElo: we,
    blackElo: be,
    event: famous ? label : tags.Event || "OTB",
    year: Number(String(tags.Date || tags.UTCDate || "").slice(0, 4)) || 0,
    result: tags.Result || "*",
    eco: opening?.eco || tags.ECO || undefined,
    opening: opening?.name || undefined,
    timeControl: tags.TimeControl || undefined,
    category: famous ? "historic" : "classical",
    level,
    tags: [label, ALIASES[label], opening ? opening.name.split(":")[0] : null].filter(Boolean),
    moves: g.history().join(" "),
  }
}

// Evenly spaced indices across [0, len) — spans a player's whole career.
function spread(len, n) {
  if (len <= n) return [...Array(len).keys()]
  const step = len / n
  return Array.from({ length: n }, (_, i) => Math.floor(i * step))
}

async function fetchText(url) {
  const res = await fetch(url, { signal: AbortSignal.timeout(45000) })
  if (!res.ok) throw new Error("HTTP " + res.status)
  return res.text()
}

async function main() {
  const seen = new Set()
  const all = []

  for (const name of PLAYERS) {
    if (all.length >= TOTAL_CAP) break
    process.stdout.write(`Fetching ${name}... `)
    let games
    try {
      games = parseGames(await fetchText(`${PM}/${name}.pgn`))
    } catch (e) {
      console.log("skip: " + (e.cause?.code || e.message))
      continue
    }
    // sample ~2x candidates, validate, keep up to PER_PLAYER
    const idx = spread(games.length, PER_PLAYER * 2)
    let added = 0
    for (const i of idx) {
      if (added >= PER_PLAYER || all.length >= TOTAL_CAP) break
      const e = buildEntry(games[i].tags, games[i].movetext, name, false)
      if (!e || seen.has(e.id)) continue
      seen.add(e.id)
      all.push(e)
      added++
    }
    console.log(`+${added} (of ${games.length})`)
  }

  for (const src of FAMOUS) {
    if (all.length >= TOTAL_CAP) break
    process.stdout.write(`Fetching ${src.label}... `)
    let games
    try {
      games = parseGames(await fetchText(src.url))
    } catch (e) {
      console.log("skip: " + (e.cause?.code || e.message))
      continue
    }
    let added = 0
    for (const g of games) {
      if (added >= src.max) break
      const e = buildEntry(g.tags, g.movetext, src.label, true)
      if (!e || seen.has(e.id)) continue
      seen.add(e.id)
      all.push(e)
      added++
    }
    console.log(`+${added}`)
  }

  writeFileSync(out, JSON.stringify(all))
  console.log(`\nWrote ${all.length} games to ${out}`)
}

main()
