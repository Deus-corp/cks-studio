// Copyright (c) 2026 Deus Corp. Licensed under MIT.

import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { useThemeStore } from '@/shared/stores/themeStore'
import { ThemeToggle } from '../SettingsPage'

afterEach(() => {
  cleanup()
  useThemeStore.getState().setTheme('dark')
})

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

describe('ThemeToggle', () => {
  it('offers Light, Dark, and Auto options', () => {
    render(<ThemeToggle />)

    expect(screen.getByRole('button', { name: /dark/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /light/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /auto/i })).toBeInTheDocument()
  })

  it('resolves and applies the light theme when Auto is chosen and the OS prefers light', () => {
    mockPrefersLight(true)
    render(<ThemeToggle />)

    fireEvent.click(screen.getByRole('button', { name: /auto/i }))

    expect(useThemeStore.getState().theme).toBe('light')
  })

  it('resolves and applies the dark theme when Auto is chosen and the OS prefers dark', () => {
    mockPrefersLight(false)
    render(<ThemeToggle />)

    fireEvent.click(screen.getByRole('button', { name: /auto/i }))

    expect(useThemeStore.getState().theme).toBe('dark')
  })

  it('shows Auto as the visibly selected option after choosing it', () => {
    mockPrefersLight(true)
    render(<ThemeToggle />)

    const autoButton = screen.getByRole('button', { name: /auto/i })
    fireEvent.click(autoButton)

    expect(autoButton).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('button', { name: /^light$/i })).toHaveAttribute(
      'aria-pressed',
      'false',
    )
    expect(screen.getByRole('button', { name: /dark/i })).toHaveAttribute(
      'aria-pressed',
      'false',
    )
  })
})
