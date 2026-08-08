// Copyright (c) 2025 Deus Corp. Licensed under MIT.

import { describe, expect, it } from 'vitest'
import { formatTags, healthColor } from '../galleryUtils'

describe('formatTags', () => {
  it('splits comma-separated tags and trims whitespace', () => {
    expect(formatTags('biology, genomics ,demo')).toEqual([
      'biology',
      'genomics',
      'demo',
    ])
  })

  it('drops empty entries', () => {
    expect(formatTags('a,,b, ,c')).toEqual(['a', 'b', 'c'])
  })

  it('returns empty array for empty string', () => {
    expect(formatTags('')).toEqual([])
  })
})

describe('healthColor', () => {
  it('is green for high scores', () => {
    expect(healthColor(0.8)).toBe('#10b981')
    expect(healthColor(1)).toBe('#10b981')
  })

  it('is amber for mid scores', () => {
    expect(healthColor(0.5)).toBe('#f59e0b')
    expect(healthColor(0.79)).toBe('#f59e0b')
  })

  it('is red for low scores', () => {
    expect(healthColor(0)).toBe('#ef4444')
    expect(healthColor(0.49)).toBe('#ef4444')
  })
})
