// Copyright (c) 2025 Deus Corp. Licensed under MIT.

import type { CksObject } from '@/shared/types/graph'
import { describe, expect, it } from 'vitest'
import {
  extractPipelineObjects,
  groupByStatus,
  sortTransitionLog,
} from '../pipelineUtils'

function makeObject(
  id: string,
  status: string | undefined,
  transitionLog: unknown = [],
): CksObject {
  return {
    identity: { id, type: 'Claim', name: `Claim ${id}` },
    structure: {
      ...(status !== undefined ? { current_status: status } : {}),
      transition_log: transitionLog,
    },
  }
}

describe('extractPipelineObjects', () => {
  it('keeps only objects with a valid current_status', () => {
    const objects = [
      makeObject('1', 'awaiting_research'),
      makeObject('2', undefined),
      makeObject('3', 'not_a_real_status'),
      makeObject('4', 'resolved'),
    ]
    const result = extractPipelineObjects(objects)
    expect(result.map((o) => o.id)).toEqual(['1', '4'])
  })

  it('filters malformed transition_log entries', () => {
    const objects = [
      makeObject('1', 'resolved', [
        {
          agent: 'reviewer',
          action: 'approve',
          transitioned_to: 'resolved',
          timestamp: 't1',
        },
        'not-an-object',
        { missing: 'transitioned_to' },
      ]),
    ]
    const result = extractPipelineObjects(objects)
    expect(result[0].transition_log).toHaveLength(1)
  })
})

describe('groupByStatus', () => {
  it('buckets objects by current_status and includes empty active statuses', () => {
    const objects = extractPipelineObjects([
      makeObject('1', 'awaiting_research'),
      makeObject('2', 'awaiting_research'),
      makeObject('3', 'resolved'),
    ])
    const grouped = groupByStatus(objects)
    expect(grouped.get('awaiting_research')).toHaveLength(2)
    expect(grouped.get('resolved')).toHaveLength(1)
    expect(grouped.get('needs_research')).toEqual([])
  })
})

describe('sortTransitionLog', () => {
  it('sorts entries chronologically', () => {
    const log = [
      {
        timestamp: '2026-01-02T00:00:00Z',
        agent: 'b',
        action: 'x',
        transitioned_to: 'y',
      },
      {
        timestamp: '2026-01-01T00:00:00Z',
        agent: 'a',
        action: 'x',
        transitioned_to: 'y',
      },
    ]
    const sorted = sortTransitionLog(log)
    expect(sorted[0].agent).toBe('a')
    expect(sorted[1].agent).toBe('b')
  })
})
