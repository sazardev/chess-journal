/**
 * Save text to a file. Uses the Tauri save dialog when available, otherwise
 * falls back to a browser download. Returns false only when the user cancels
 * the native dialog.
 */
export async function saveTextFile(
  defaultName: string,
  extensions: string[],
  filterName: string,
  mime: string,
  content: string,
): Promise<boolean> {
  try {
    const { save } = await import("@tauri-apps/plugin-dialog")
    const { writeTextFile } = await import("@tauri-apps/plugin-fs")
    const path = await save({
      defaultPath: defaultName,
      filters: [{ name: filterName, extensions }],
    })
    if (!path) return false
    await writeTextFile(path, content)
    return true
  } catch {
    const blob = new Blob([content], { type: mime })
    const url = URL.createObjectURL(blob)
    const link = document.createElement("a")
    link.href = url
    link.download = defaultName
    link.click()
    URL.revokeObjectURL(url)
    return true
  }
}

/** Turn an arbitrary game name into a safe-ish filename stem. */
export function fileStem(name: string): string {
  const cleaned = name.trim().replace(/[^\w-]+/g, "-").replace(/^-+|-+$/g, "")
  return cleaned || "game"
}
