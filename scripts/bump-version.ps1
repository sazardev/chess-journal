param(
    [Parameter(Mandatory=$true)]
    [string]$Version
)

$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot

function Update-Json($path, $key, $value) {
    $json = Get-Content $path -Raw | ConvertFrom-Json -AsHashtable
    $json[$key] = $value
    $json | ConvertTo-Json -Depth 10 | Set-Content $path -Encoding UTF8
    Write-Host "  $path → $key = $value"
}

function Update-Toml($path, $value) {
    $content = Get-Content $path -Raw
    $content = $content -replace '^version = ".*"', "version = ""$value"""
    Set-Content $path $content -Encoding UTF8
    Write-Host "  $path → version = $value"
}

Write-Host "Bumping to $Version ..."

Update-Json "$root\package.json" "version" $Version
Update-Json "$root\src-tauri\tauri.conf.json" "version" $Version
Update-Toml "$root\src-tauri\Cargo.toml" $Version

Write-Host "Done. Version bumped to $Version across all configs."
