// Copyright (c) 2026 Deus Corp. Licensed under MIT.

import type { Edge, Node } from '@xyflow/react'
import { describe, expect, it } from 'vitest'
import {
  findInferenceStepsFor,
  findProvenanceFor,
  findReasoningNodesFor,
} from '../sidePanelUtils'

function makeNode(
  id: string,
  cksType: string,
  structure: Record<string, unknown> = {},
  label?: string,
): Node {
  return {
    id,
    type: 'cksNode',
    position: { x: 0, y: 0 },
    data: { label: label || id, cksType, structure },
  }
}

describe('findInferenceStepsFor', () => {
  it('returns the node itself when it is an InferenceStep', () => {
    const step = makeNode('step-1', 'InferenceStep', {
      operator: 'modus_ponens',
      confidence: 0.8,
    })
    const result = findInferenceStepsFor(step, [step], [])
    expect(result).toHaveLength(1)
    expect(result[0].operator).toBe('modus_ponens')
  })

  it('finds an InferenceStep linked via an edge', () => {
    const target = makeNode('rose', 'Plant')
    const step = makeNode('step-1', 'InferenceStep', {
      operator: 'modus_ponens',
    })
    const edges: Edge[] = [
      { id: 'e1', source: 'step-1', target: 'rose' } as Edge,
    ]
    const result = findInferenceStepsFor(target, [target, step], edges)
    expect(result).toHaveLength(1)
    expect(result[0].step_id).toBe('step-1')
  })

  it('finds an InferenceStep via structure.object_id', () => {
    const target = makeNode('rose', 'Plant')
    const step = makeNode('step-1', 'InferenceStep', { object_id: 'rose' })
    const result = findInferenceStepsFor(target, [target, step], [])
    expect(result).toHaveLength(1)
  })

  it('finds an InferenceStep via structure.concludes', () => {
    const target = makeNode('rose', 'Plant')
    const step = makeNode('step-1', 'InferenceStep', { concludes: 'rose' })
    const result = findInferenceStepsFor(target, [target, step], [])
    expect(result).toHaveLength(1)
  })

  it('finds an InferenceStep via structure.conclusion (manually authored steps)', () => {
    const target = makeNode('rose', 'Plant', {}, 'Роза')
    const step = makeNode('step-manual-1', 'InferenceStep', {
      conclusion: 'rose',
      operator: 'manual',
      confidence: 1,
      justification: 'Added by hand during testing',
    })
    const result = findInferenceStepsFor(target, [target, step], [])
    expect(result).toHaveLength(1)
    expect(result[0].step_id).toBe('step-manual-1')
    expect(result[0].justification).toBe('Added by hand during testing')
  })

  it('returns an empty array when nothing concludes the node', () => {
    const target = makeNode('rose', 'Plant')
    const unrelated = makeNode('step-1', 'InferenceStep', {
      conclusion: 'some-other-node',
    })
    const result = findInferenceStepsFor(target, [target, unrelated], [])
    expect(result).toHaveLength(0)
  })
})

describe('findReasoningNodesFor', () => {
  it('finds ReasoningNode via structure.object_id', () => {
    const target = makeNode('rose', 'Plant')
    const finding = makeNode('finding-1', 'ReasoningNode', {
      object_id: 'rose',
      agent: 'ResearcherAgent',
    })
    const result = findReasoningNodesFor('rose', [target, finding], [])
    expect(result).toHaveLength(1)
    expect(result[0].agent).toBe('ResearcherAgent')
  })
})

describe('findProvenanceFor', () => {
  it('returns empty when there is no provenance data', () => {
    const target = makeNode('rose', 'Plant')
    const result = findProvenanceFor(target, [target], [])
    expect(result.ownProvenance).toBeNull()
    expect(result.verificationRecords).toHaveLength(0)
  })
})
