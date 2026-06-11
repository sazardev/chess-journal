#!/usr/bin/env node
// Patch the generated Android project for a clean, coherent native shell.
// Run AFTER `tauri android init` (gen/android is regenerated each time, so this
// must re-apply — same pattern as the manifest adjustResize step in CI).
// Usage: node scripts/patch-android.mjs
//
// What it does:
//  - Forces a LIGHT system theme in both day and night modes. The web UI is
//    white-only (color-scheme: light), so the native chrome must stay light in
//    dark mode too — otherwise the status/nav bars flip and look incoherent.
//  - Edge-to-edge is enabled in MainActivity, so the WebView draws behind the
//    system bars. We make them transparent and request DARK icons
//    (windowLightStatusBar / windowLightNavigationBar) so the clock, battery
//    and nav glyphs stay visible against the white app.
//  - White window background kills the black cold-start flash before the
//    WebView paints.

import { existsSync, writeFileSync } from "node:fs"
import { fileURLToPath } from "node:url"
import { dirname, join } from "node:path"

const root = join(dirname(fileURLToPath(import.meta.url)), "..")
const resRoot = join(root, "src-tauri", "gen", "android", "app", "src", "main", "res")

if (!existsSync(resRoot)) {
  console.error(`gen/android not found at ${resRoot} — run \`tauri android init\` first.`)
  process.exit(0) // soft-exit: nothing to patch yet, don't fail the pipeline
}

// Identical theme for values/ (light mode) and values-night/ (dark mode): the
// app is always light, so the system chrome must match in both.
const THEME = `<resources xmlns:tools="http://schemas.android.com/tools">
    <!-- Generated, then patched by scripts/patch-android.mjs. -->
    <style name="Theme.chess_journal" parent="Theme.MaterialComponents.Light.NoActionBar">
        <item name="android:windowBackground">@android:color/white</item>
        <item name="android:statusBarColor">@android:color/transparent</item>
        <item name="android:navigationBarColor">@android:color/transparent</item>
        <item name="android:windowLightStatusBar">true</item>
        <item name="android:windowLightNavigationBar" tools:targetApi="o_mr1">true</item>
    </style>
</resources>
`

for (const dir of ["values", "values-night"]) {
  const file = join(resRoot, dir, "themes.xml")
  writeFileSync(file, THEME)
  console.log(`patched ${dir}/themes.xml`)
}

console.log("Android theme patched — light chrome, transparent bars, dark system icons.")
