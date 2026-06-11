#!/usr/bin/env node
// Cross-platform version bump for Chess Journal.
// Usage: node scripts/bump-version.mjs <patch|minor|major|X.Y.Z>
// Updates package.json, src-tauri/tauri.conf.json, src-tauri/Cargo.toml and CHANGELOG.md.

import { readFileSync, writeFileSync } from "node:fs"
import { fileURLToPath } from "node:url"
import { dirname, join } from "node:path"

const root = join(dirname(fileURLToPath(import.meta.url)), "..")
const arg = process.argv[2]
if (!arg) {
  console.error("Usage: node scripts/bump-version.mjs <patch|minor|major|X.Y.Z>")
  process.exit(1)
}

const pkgPath = join(root, "package.json")
const pkg = JSON.parse(readFileSync(pkgPath, "utf-8"))
const current = pkg.version

function nextVersion(curr, bump) {
  if (/^\d+\.\d+\.\d+$/.test(bump)) return bump
  const [maj, min, pat] = curr.split(".").map(Number)
  if (bump === "major") return `${maj + 1}.0.0`
  if (bump === "minor") return `${maj}.${min + 1}.0`
  if (bump === "patch") return `${maj}.${min}.${pat + 1}`
  throw new Error(`Invalid bump: ${bump}`)
}

const version = nextVersion(current, arg)
console.log(`Bumping ${current} -> ${version}`)

// package.json
pkg.version = version
writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + "\n")

// tauri.conf.json
const confPath = join(root, "src-tauri", "tauri.conf.json")
const conf = JSON.parse(readFileSync(confPath, "utf-8"))
conf.version = version
writeFileSync(confPath, JSON.stringify(conf, null, 2) + "\n")

// Cargo.toml (only the [package] version, which is line-anchored)
const cargoPath = join(root, "src-tauri", "Cargo.toml")
let cargo = readFileSync(cargoPath, "utf-8")
cargo = cargo.replace(/^version = ".*"/m, `version = "${version}"`)
writeFileSync(cargoPath, cargo)

// CHANGELOG.md — promote [Unreleased] into a dated release section.
const changelogPath = join(root, "CHANGELOG.md")
let changelog = readFileSync(changelogPath, "utf-8")
const date = new Date().toISOString().slice(0, 10)
if (changelog.includes("## [Unreleased]")) {
  changelog = changelog.replace(
    "## [Unreleased]",
    `## [Unreleased]\n\n## [${version}] - ${date}`,
  )
  writeFileSync(changelogPath, changelog)
}

console.log(`Done. Version is now ${version}.`)
