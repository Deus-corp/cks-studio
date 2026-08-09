// Copyright (c) 2025 Deus Corp. Licensed under MIT.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { formatRelativeTime } from '../formatUtils'

describe('formatRelativeTime', () => {
  const NOW = new Date('2026-08-09T12:00:00.000Z')

  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(NOW)
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('returns "never" for null', () => {
    expect(formatRelativeTime(null)).toBe('never')
  })

  it('returns "never" for an unparseable timestamp', () => {
    expect(formatRelativeTime('not-a-date')).toBe('never')
  })

  it('returns "just now" for timestamps under a minute old', () => {
    expect(
      formatRelativeTime(new Date(NOW.getTime() - 30_000).toISOString()),
    ).toBe('just now')
  })

  it('formats minutes', () => {
    expect(
      formatRelativeTime(new Date(NOW.getTime() - 3 * 60_000).toISOString()),
    ).toBe('3m ago')
  })

  it('formats hours', () => {
    expect(
      formatRelativeTime(
        new Date(NOW.getTime() - 2 * 60 * 60_000).toISOString(),
      ),
    ).toBe('2h ago')
  })

  it('formats days for long-interval sweepers (e.g. graph_health)', () => {
    expect(
      formatRelativeTime(
        new Date(NOW.getTime() - 3 * 24 * 60 * 60_000).toISOString(),
      ),
    ).toBe('3d ago')
  })
})
