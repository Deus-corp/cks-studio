// Copyright (c) 2026 Deus Corp. Licensed under MIT.

import { cleanup, render } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { useThemeStore } from '@/shared/stores/themeStore'
import { SettingsPage } from '../SettingsPage'

afterEach(() => {
  cleanup()
  useThemeStore.getState().setTheme('dark')
})

describe('SettingsPage theme stability (regression)', () => {
  it('does not change the active theme just from mounting Settings', () => {
    useThemeStore.getState().setTheme('dark')
    expect(useThemeStore.getState().theme).toBe('dark')

    render(<SettingsPage />)

    // Rendering/navigating to Settings must never itself change the
    // theme -- only an explicit user click on a theme option may.
    expect(useThemeStore.getState().theme).toBe('dark')
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark')
  })

  it('keeps a light theme stable across a Settings mount too', () => {
    useThemeStore.getState().setTheme('light')
    expect(useThemeStore.getState().theme).toBe('light')

    render(<SettingsPage />)

    expect(useThemeStore.getState().theme).toBe('light')
    expect(document.documentElement.getAttribute('data-theme')).toBe('light')
  })
})
