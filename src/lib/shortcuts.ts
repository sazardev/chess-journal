export interface Shortcut {
  keys: string
  label: string
}

export interface ShortcutGroup {
  title: string
  items: Shortcut[]
}

export const SHORTCUT_GROUPS: ShortcutGroup[] = [
  {
    title: "Navigate",
    items: [
      { keys: "← / →", label: "Previous / next move" },
      { keys: "Ctrl ⌂ / End", label: "Jump to start / end" },
      { keys: "Space", label: "Play / pause" },
      { keys: "Ctrl ⇧ ← / →", label: "Prev / next bookmark" },
    ],
  },
  {
    title: "Edit",
    items: [
      { keys: "Ctrl Z", label: "Undo move" },
      { keys: "Ctrl I", label: "Focus move input" },
      { keys: "Ctrl ⇧ B", label: "Toggle bookmark" },
    ],
  },
  {
    title: "Annotate",
    items: [
      { keys: "Ctrl A", label: "Arrow mode" },
      { keys: "Ctrl M", label: "Mark mode" },
      { keys: "Ctrl X", label: "Clear annotations" },
    ],
  },
  {
    title: "Games",
    items: [
      { keys: "Ctrl S", label: "Save now" },
      { keys: "Ctrl N", label: "New game" },
      { keys: "Ctrl D", label: "Toggle favorite" },
      { keys: "Ctrl L", label: "Toggle library" },
    ],
  },
  {
    title: "View",
    items: [
      { keys: "Ctrl B", label: "Flip board" },
      { keys: "Ctrl ,", label: "Settings" },
      { keys: "?", label: "This panel" },
      { keys: "Esc", label: "Close / deselect" },
    ],
  },
]
