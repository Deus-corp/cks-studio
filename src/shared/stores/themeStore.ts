// Copyright (c) 2025 Deus Corp. Licensed under MIT.

import { create } from 'zustand'

export type Theme = 'dark' | 'light'

const STORAGE_KEY = 'cks-studio:theme'

function readStoredTheme(): Theme {
  if (typeof window === 'undefined') return 'dark'
  const stored = window.localStorage.getItem(STORAGE_KEY)
  if (stored === 'light' || stored === 'dark') return stored
  // No explicit preference yet — fall back to the OS/browser setting
  // rather than always defaulting to dark, so a light-mode user's first
  // visit already looks right.
  if (window.matchMedia?.('(prefers-color-scheme: light)').matches) {
    return 'light'
  }
  return 'dark'
}

function applyTheme(theme: Theme) {
  if (typeof document === 'undefined') return
  document.documentElement.setAttribute('data-theme', theme)
}

export interface ThemeState {
  theme: Theme
  setTheme: (theme: Theme) => void
  toggleTheme: () => void
}

const initialTheme = readStoredTheme()
applyTheme(initialTheme)

/**
 * Light/dark theme preference. Tokens for both live in styles/index.css
 * (base = dark, `[data-theme="light"]` = override block); this store just
 * owns which one is active, persists the choice, and keeps the
 * `data-theme` attribute on <html> in sync so plain CSS handles the rest.
 */
export const useThemeStore = create<ThemeState>((set, get) => ({
  theme: initialTheme,
  setTheme: (theme) => {
    window.localStorage.setItem(STORAGE_KEY, theme)
    applyTheme(theme)
    set({ theme })
  },
  toggleTheme: () => {
    const next: Theme = get().theme === 'dark' ? 'light' : 'dark'
    get().setTheme(next)
  },
}))
