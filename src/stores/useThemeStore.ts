import { create } from "zustand"

type Theme = "light" | "dark"

interface ThemeState {
  theme: Theme
  toggle: () => void
  set: (theme: Theme) => void
}

export const useThemeStore = create<ThemeState>((set) => ({
  theme: (localStorage.getItem("chess-mini-theme") as Theme) || "light",

  toggle: () =>
    set((state) => {
      const next = state.theme === "light" ? "dark" : "light"
      localStorage.setItem("chess-mini-theme", next)
      return { theme: next }
    }),

  set: (theme) => {
    localStorage.setItem("chess-mini-theme", theme)
    set({ theme })
  },
}))
