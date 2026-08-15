// Copyright (c) 2026 Deus Corp. Licensed under MIT.

import { describe, expect, it } from 'vitest'
import {
  filterRunsByStatus,
  sortRunsByUpdatedAt,
  truncateRunId,
} from '../pipelineRunUtils'
import type { PipelineRun } from '../types'

function run(overrides: Partial<PipelineRun> = {}): PipelineRun {
  return {
    runId: 'run-7f2a9c1e-0001',
    sessionId: 'sess-1',
    status: 'completed',
    startedAt: '2026-08-10T09:12:00Z',
    updatedAt: '2026-08-10T09:18:42Z',
    objectIds: ['obj-1'],
    steps: [],
    ...overrides,
  }
}

describe('truncateRunId', () => {
  it('shortens a run id to first…last segment', () => {
    expect(truncateRunId('run-7f2a9c1e-0001')).toBe('7f2a9c1e…0001')
  })

  it('returns short ids unchanged', () => {
    expect(truncateRunId('abc')).toBe('abc')
    expect(truncateRunId('a-b')).toBe('a-b')
  })
})

describe('sortRunsByUpdatedAt', () => {
  it('orders runs most-recently-updated first', () => {
    const older = run({ runId: 'a', updatedAt: '2026-08-10T09:00:00Z' })
    const newer = run({ runId: 'b', updatedAt: '2026-08-12T09:00:00Z' })
    const mid = run({ runId: 'c', updatedAt: '2026-08-11T09:00:00Z' })

    expect(
      sortRunsByUpdatedAt([older, newer, mid]).map((r) => r.runId),
    ).toEqual(['b', 'c', 'a'])
  })

  it('does not mutate the input array', () => {
    const input = [run({ runId: 'a' }), run({ runId: 'b' })]
    const copy = [...input]
    sortRunsByUpdatedAt(input)
    expect(input).toEqual(copy)
  })
})

describe('filterRunsByStatus', () => {
  it('returns all runs for "all"', () => {
    const runs = [run({ status: 'completed' }), run({ status: 'failed' })]
    expect(filterRunsByStatus(runs, 'all')).toHaveLength(2)
  })

  it('filters by a specific status', () => {
    const runs = [
      run({ runId: 'a', status: 'completed' }),
      run({ runId: 'b', status: 'failed' }),
      run({ runId: 'c', status: 'failed' }),
    ]
    const failed = filterRunsByStatus(runs, 'failed')
    expect(failed.map((r) => r.runId)).toEqual(['b', 'c'])
  })
})
