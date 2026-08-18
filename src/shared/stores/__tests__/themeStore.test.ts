// Copyright (c) 2026 Deus Corp. Licensed under MIT.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const STORAGE_KEY = 'cks-studio:theme'

function mockPrefersLight(matches: boolean) {
  vi.stubGlobal(
    'matchMedia',
    vi.fn().mockImplementation((query: string) => ({
      matches: query === '(prefers-color-scheme: light)' ? matches : false,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  )
}

// themeStore reads localStorage and applies the initial theme once, at
// module-evaluation time -- so "first visit" behavior can only be
// observed by resetting the module registry and re-importing fresh,
// the same way a real first page load would evaluate the module once.
async function freshImport() {
  vi.resetModules()
  return import('../themeStore')
}

beforeEach(() => {
  window.localStorage.clear()
})

afterEach(() => {
  window.localStorage.clear()
  vi.unstubAllGlobals()
  vi.resetModules()
})

describe('themeStore — first-visit default', () => {
  it('defaults mode to auto (not dark) when no preference is stored', async () => {
    mockPrefersLight(false)
    const { useThemeStore } = await freshImport()

    expect(useThemeStore.getState().mode).toBe('auto')
  })

  it('persists the auto default to localStorage on first visit', async () => {
    mockPrefersLight(false)
    await freshImport()

    expect(window.localStorage.getItem(STORAGE_KEY)).toBe('auto')
  })

  it('resolves the initial theme from the OS preference on first visit', async () => {
    mockPrefersLight(true)
    const { useThemeStore } = await freshImport()

    expect(useThemeStore.getState().theme).toBe('light')
  })

  it('does not override an explicit previously-saved choice', async () => {
    window.localStorage.setItem(STORAGE_KEY, 'dark')
    mockPrefersLight(true)
    const { useThemeStore } = await freshImport()

    expect(useThemeStore.getState().mode).toBe('dark')
    expect(useThemeStore.getState().theme).toBe('dark')
  })
})

describe('themeStore — persistence across restarts', () => {
  it('keeps a saved mode after a simulated restart (fresh module load)', async () => {
    let mod = await freshImport()
    mod.useThemeStore.getState().setTheme('light')
    expect(window.localStorage.getItem(STORAGE_KEY)).toBe('light')

    // Simulate an app restart: re-import the module fresh, the way a new
    // page load would, and confirm the saved preference is honored.
    mod = await freshImport()
    expect(mod.useThemeStore.getState().mode).toBe('light')
    expect(mod.useThemeStore.getState().theme).toBe('light')
  })
})

describe('themeStore — selecting Auto', () => {
  it('sets mode to auto and persists it when chosen explicitly', async () => {
    mockPrefersLight(true)
    const { useThemeStore } = await freshImport()
    useThemeStore.getState().setTheme('dark')

    useThemeStore.getState().setTheme('auto')

    expect(useThemeStore.getState().mode).toBe('auto')
    expect(useThemeStore.getState().theme).toBe('light')
    expect(window.localStorage.getItem(STORAGE_KEY)).toBe('auto')
  })
})

describe('themeStore — reading state never mutates it', () => {
  it('merely reading mode/theme from the store does not change localStorage', async () => {
    mockPrefersLight(false)
    const { useThemeStore } = await freshImport()
    const before = window.localStorage.getItem(STORAGE_KEY)

    // Multiple plain reads, as a subscribing component would do.
    void useThemeStore.getState().mode
    void useThemeStore.getState().theme
    void useThemeStore.getState().mode

    expect(window.localStorage.getItem(STORAGE_KEY)).toBe(before)
  })
})
