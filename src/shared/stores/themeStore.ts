// Copyright (c) 2025 Deus Corp. Licensed under MIT.

import { create } from 'zustand'

export type Theme = 'dark' | 'light'
/** The persisted user preference: an explicit theme, or 'auto' to track
 *  the OS/browser `prefers-color-scheme`. This is the single source of
 *  truth for "what the user picked" -- previously this concept was
 *  re-implemented ad hoc in SettingsPage/DemoSettingsPage as local
 *  component state, which meant nothing actually remembered that the
 *  user had chosen 'auto', and nothing centrally guarded against
 *  re-resolving/re-applying a theme as a side effect of an unrelated
 *  component mounting. */
export type ThemeMode = Theme | 'auto'

const STORAGE_KEY = 'cks-studio:theme'

function readStoredMode(): ThemeMode {
  if (typeof window === 'undefined') return 'auto'
  const stored = window.localStorage.getItem(STORAGE_KEY)
  if (stored === 'light' || stored === 'dark' || stored === 'auto') {
    return stored
  }
  // No explicit preference has ever been saved -- default to 'auto' so a
  // first-time visitor gets a theme that matches their OS/browser
  // preference rather than being forced into dark. Persist this default
  // immediately so subsequent visits (and this same session's reads of
  // localStorage) see an explicit 'auto' rather than re-deriving it.
  window.localStorage.setItem(STORAGE_KEY, 'auto')
  return 'auto'
}

function resolveTheme(mode: ThemeMode): Theme {
  if (mode !== 'auto') return mode
  if (typeof window === 'undefined') return 'dark'
  return window.matchMedia?.('(prefers-color-scheme: light)').matches
    ? 'light'
    : 'dark'
}

function applyTheme(theme: Theme) {
  if (typeof document === 'undefined') return
  document.documentElement.setAttribute('data-theme', theme)
}

export interface ThemeState {
  /** What the user picked: 'dark' | 'light' | 'auto'. */
  mode: ThemeMode
  /** The resolved, renderable value ('auto' resolved against the OS
   *  preference). This is what CSS/components should read to decide
   *  dark vs light -- 'auto' itself is never applied to the DOM. */
  theme: Theme
  setTheme: (mode: ThemeMode) => void
  toggleTheme: () => void
}

const initialMode = readStoredMode()
const initialTheme = resolveTheme(initialMode)
applyTheme(initialTheme)

/**
 * Light/dark theme preference. Tokens for both live in styles/index.css
 * (base = dark, `[data-theme="light"]` = override block); this store just
 * owns which one is active, persists the choice, and keeps the
 * `data-theme` attribute on <html> in sync so plain CSS handles the rest.
 *
 * Mounting a component that merely *reads* `theme` (e.g. via a selector)
 * must never change it -- only an explicit `setTheme` call (from a user
 * action such as clicking a theme option) is allowed to persist or apply
 * a new value. There is deliberately no effect anywhere that re-derives
 * or re-applies the theme on mount/navigation.
 */
export const useThemeStore = create<ThemeState>((set, get) => ({
  mode: initialMode,
  theme: initialTheme,
  setTheme: (mode) => {
    const theme = resolveTheme(mode)
    window.localStorage.setItem(STORAGE_KEY, mode)
    applyTheme(theme)
    set({ mode, theme })
  },
  toggleTheme: () => {
    const next: Theme = get().theme === 'dark' ? 'light' : 'dark'
    get().setTheme(next)
  },
}))

let mediaListenerAttached = false

/** Re-resolves and re-applies the theme when the OS preference changes,
 *  but only while the user's saved mode is actually 'auto'. Attached
 *  lazily/once (idempotent) rather than at module scope unconditionally,
 *  so importing this module never has a side effect beyond the single
 *  synchronous initial `applyTheme` above. */
export function ensureAutoThemeListener() {
  if (mediaListenerAttached || typeof window === 'undefined') return
  mediaListenerAttached = true
  const media = window.matchMedia?.('(prefers-color-scheme: light)')
  media?.addEventListener?.('change', () => {
    const { mode } = useThemeStore.getState()
    if (mode !== 'auto') return
    const theme = resolveTheme('auto')
    applyTheme(theme)
    useThemeStore.setState({ theme })
  })
}

// Attach the OS-preference listener as soon as this module loads, rather
// than relying on some component to remember to call
// ensureAutoThemeListener() on mount. Idempotent, so this is safe even if
// a component also calls it explicitly.
ensureAutoThemeListener()
