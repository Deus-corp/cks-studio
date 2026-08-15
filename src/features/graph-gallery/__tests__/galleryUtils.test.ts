// Copyright (c) 2025 Deus Corp. Licensed under MIT.

import { describe, expect, it } from 'vitest'
import type { GraphRegistryEntry } from '@/shared/types/graph'
import {
  collectTags,
  formatTags,
  healthColor,
  sortGraphs,
} from '../galleryUtils'

function graph(
  overrides: Partial<GraphRegistryEntry> = {},
): GraphRegistryEntry {
  return {
    name: 'graph-a',
    session_id: 'sess-1',
    description: '',
    tags: '',
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
    public: true,
    ...overrides,
  }
}

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

describe('collectTags', () => {
  it('returns the sorted union of tags across all graphs, deduped', () => {
    const graphs = [
      graph({ name: 'a', tags: 'biology, demo' }),
      graph({ name: 'b', tags: 'genomics, demo' }),
    ]
    expect(collectTags(graphs)).toEqual(['biology', 'demo', 'genomics'])
  })

  it('returns an empty array when no graph has tags', () => {
    expect(collectTags([graph({ tags: '' })])).toEqual([])
  })

  it('returns an empty array for an empty graph list', () => {
    expect(collectTags([])).toEqual([])
  })
})

describe('sortGraphs', () => {
  const graphs = [
    graph({ name: 'Charlie', updated_at: '2026-01-02T00:00:00Z' }),
    graph({ name: 'alice', updated_at: '2026-01-03T00:00:00Z' }),
    graph({ name: 'Bob', updated_at: '2026-01-01T00:00:00Z' }),
  ]

  it('sorts by name ascending, case-insensitively', () => {
    expect(sortGraphs(graphs, 'name_asc').map((g) => g.name)).toEqual([
      'alice',
      'Bob',
      'Charlie',
    ])
  })

  it('sorts by name descending, case-insensitively', () => {
    expect(sortGraphs(graphs, 'name_desc').map((g) => g.name)).toEqual([
      'Charlie',
      'Bob',
      'alice',
    ])
  })

  it('sorts by most recently updated first by default', () => {
    expect(sortGraphs(graphs, 'updated_desc').map((g) => g.name)).toEqual([
      'alice',
      'Charlie',
      'Bob',
    ])
  })

  it('does not mutate the input array', () => {
    const original = [...graphs]
    sortGraphs(graphs, 'name_asc')
    expect(graphs).toEqual(original)
  })
})
