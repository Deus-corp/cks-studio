// Copyright (c) 2026 Deus Corp. Licensed under MIT.

import type { Edge, Node } from '@xyflow/react'

/** Structure fields carried by a `ReasoningNode` object, as surfaced in
 *  the Agent Findings / Research section. All optional -- older graphs
 *  or hand-authored objects may be missing some of these. */
export interface ReasoningNodeFinding {
  id: string
  name: string | undefined
  kind: string | undefined
  agent: string | undefined
  model: string | undefined
  content: string | undefined
  object_id: string | undefined
}

/** Fields carried by an `InferenceStep` object's structure, whether the
 *  step *is* the selected node or is a step concluding it. */
export interface InferenceStepFields {
  step_id: string | undefined
  operator: string | undefined
  confidence: number | string | undefined
  justification: string | undefined
  premises: unknown[]
}

function getStructure(node: Node): Record<string, unknown> {
  return (node.data?.structure as Record<string, unknown>) || {}
}

function getCksType(node: Node): string | undefined {
  return node.data?.cksType as string | undefined
}

/**
 * `ReasoningNode` objects whose finding targets `targetId` -- either via
 * an explicit edge (source is the ReasoningNode, target is `targetId`)
 * or via `structure.object_id` pointing at it directly (a ReasoningNode
 * can exist before the graph has an edge materialised for it yet).
 */
export function findReasoningNodesFor(
  targetId: string,
  nodes: Node[],
  edges: Edge[],
): ReasoningNodeFinding[] {
  const linkedBySelf = new Set(
    edges.filter((e) => e.target === targetId).map((e) => e.source),
  )

  return nodes
    .filter((n) => {
      if (getCksType(n) !== 'ReasoningNode') return false
      const structure = getStructure(n)
      return linkedBySelf.has(n.id) || structure.object_id === targetId
    })
    .map((n) => {
      const structure = getStructure(n)
      return {
        id: n.id,
        name: (n.data?.label as string) || (structure.name as string),
        kind: structure.kind as string | undefined,
        agent: structure.agent as string | undefined,
        model: structure.model as string | undefined,
        content: structure.content as string | undefined,
        object_id: structure.object_id as string | undefined,
      }
    })
}

/**
 * Inference chain info for `node`: if the node itself is an
 * `InferenceStep`, its own structure fields; otherwise, any
 * `InferenceStep` nodes in the graph that conclude it (edge pointing at
 * it, or `structure.object_id`/`structure.concludes` naming it).
 * Returns an empty array when nothing is found -- callers render the
 * "No inference chain found" empty state in that case.
 */
export function findInferenceStepsFor(
  node: Node,
  nodes: Node[],
  edges: Edge[],
): InferenceStepFields[] {
  const structure = getStructure(node)

  if (getCksType(node) === 'InferenceStep') {
    return [
      {
        step_id: (structure.step_id as string) || node.id,
        operator: structure.operator as string | undefined,
        confidence: structure.confidence as number | string | undefined,
        justification: structure.justification as string | undefined,
        premises: (structure.premises as unknown[]) || [],
      },
    ]
  }

  const linkedBySelf = new Set(
    edges.filter((e) => e.target === node.id).map((e) => e.source),
  )

  return nodes
    .filter((n) => {
      if (getCksType(n) !== 'InferenceStep') return false
      const s = getStructure(n)
      return (
        linkedBySelf.has(n.id) ||
        s.object_id === node.id ||
        s.concludes === node.id
      )
    })
    .map((n) => {
      const s = getStructure(n)
      return {
        step_id: (s.step_id as string) || n.id,
        operator: s.operator as string | undefined,
        confidence: s.confidence as number | string | undefined,
        justification: s.justification as string | undefined,
        premises: (s.premises as unknown[]) || [],
      }
    })
}

/** Provenance / verification info: either provenance ids embedded
 *  directly in the node's own structure, or `VerificationRecord` nodes
 *  connected to it by an edge in either direction. Empty means the
 *  section should be hidden entirely. */
export function findProvenanceFor(
  node: Node,
  nodes: Node[],
  edges: Edge[],
): { ownProvenance: unknown; verificationRecords: Node[] } {
  const structure = getStructure(node)
  const ownProvenance = structure.provenance ?? structure.provenance_id ?? null

  const connectedIds = new Set(
    edges
      .filter((e) => e.source === node.id || e.target === node.id)
      .map((e) => (e.source === node.id ? e.target : e.source)),
  )

  const verificationRecords = nodes.filter(
    (n) => connectedIds.has(n.id) && getCksType(n) === 'VerificationRecord',
  )

  return { ownProvenance, verificationRecords }
}
