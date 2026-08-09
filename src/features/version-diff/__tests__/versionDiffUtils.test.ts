import { describe, expect, it } from 'vitest'
import type { ExplainDiffResult, VersionEntry } from '@/shared/types/graph'
import {
  countDiffChanges,
  formatDiffValue,
  sortVersionsDesc,
} from '../versionDiffUtils'

function emptyDetails(): ExplainDiffResult['details'] {
  return {
    added_objects: [],
    removed_objects: [],
    modified_objects: [],
    added_relations: [],
    removed_relations: [],
    modified_relations: [],
    relinked_relations: [],
    renamed_objects: [],
    added_inference_steps: [],
  }
}

describe('sortVersionsDesc', () => {
  it('sorts versions from newest to oldest', () => {
    const versions: VersionEntry[] = [
      {
        version_id: 'v1',
        created_at: '2026-01-01T00:00:00Z',
        transaction_id: 't1',
        metadata: {},
      },
      {
        version_id: 'v3',
        created_at: '2026-03-01T00:00:00Z',
        transaction_id: 't3',
        metadata: {},
      },
      {
        version_id: 'v2',
        created_at: '2026-02-01T00:00:00Z',
        transaction_id: 't2',
        metadata: {},
      },
    ]
    const sorted = sortVersionsDesc(versions)
    expect(sorted.map((v) => v.version_id)).toEqual(['v3', 'v2', 'v1'])
  })

  it('does not mutate the input array', () => {
    const versions: VersionEntry[] = [
      {
        version_id: 'v1',
        created_at: '2026-01-01T00:00:00Z',
        transaction_id: 't1',
        metadata: {},
      },
      {
        version_id: 'v2',
        created_at: '2026-02-01T00:00:00Z',
        transaction_id: 't2',
        metadata: {},
      },
    ]
    const original = [...versions]
    sortVersionsDesc(versions)
    expect(versions).toEqual(original)
  })
})

describe('countDiffChanges', () => {
  it('returns all zeros and totalChanges 0 for an empty diff', () => {
    const counts = countDiffChanges(emptyDetails())
    expect(counts.totalChanges).toBe(0)
    expect(counts.addedObjects).toBe(0)
    expect(counts.modifiedRelations).toBe(0)
  })

  it('sums all change categories into totalChanges', () => {
    const details = emptyDetails()
    details.added_objects = [
      { id: 'a', action: 'added', type: 'Claim', name: 'A' },
    ]
    details.removed_objects = [
      { id: 'b', action: 'deleted', type: 'Claim', name: 'B' },
    ]
    details.modified_objects = [
      { id: 'c', action: 'modified', type: 'Claim', name: 'C', changes: {} },
    ]
    details.added_relations = [
      { id: 'r1', action: 'added', type: 'Relation', name: 'r1' },
    ]
    details.renamed_objects = [{ id: 'd', new_name: 'D2' }]

    const counts = countDiffChanges(details)
    expect(counts.addedObjects).toBe(1)
    expect(counts.removedObjects).toBe(1)
    expect(counts.modifiedObjects).toBe(1)
    expect(counts.addedRelations).toBe(1)
    expect(counts.renamedObjects).toBe(1)
    expect(counts.totalChanges).toBe(5)
  })
})

describe('formatDiffValue', () => {
  it('renders an em-dash for null/undefined', () => {
    expect(formatDiffValue(null)).toBe('—')
    expect(formatDiffValue(undefined)).toBe('—')
  })

  it('renders strings and primitives as-is', () => {
    expect(formatDiffValue('hello')).toBe('hello')
    expect(formatDiffValue(42)).toBe('42')
    expect(formatDiffValue(true)).toBe('true')
  })

  it('JSON-stringifies objects and arrays', () => {
    expect(formatDiffValue({ a: 1 })).toBe('{"a":1}')
    expect(formatDiffValue([1, 2])).toBe('[1,2]')
  })
})
