import type { SubgraphResult } from '@/shared/types/graph'

/** Начальный граф (то, что видно сразу) */
export function getMockGraph(): SubgraphResult {
  return {
    nodes: [
      {
        identity: { id: 'concept-1', type: 'Definition', name: 'Knowledge' },
        structure: { description: 'Canonical representation of information' },
      },
      {
        identity: { id: 'concept-2', type: 'Claim', name: 'Knowledge is immutable' },
        structure: { statement: 'Knowledge, once validated, never changes.' },
      },
      {
        identity: { id: 'concept-3', type: 'Claim', name: 'Immutability prevents tampering' },
        structure: {
          statement: 'Immutability guarantees that knowledge cannot be altered.',
        },
      },
    ],
    edges: [
      { source: 'concept-2', target: 'concept-1', relation_type: 'depends_on' },
      { source: 'concept-3', target: 'concept-2', relation_type: 'supports' },
    ],
  }
}

// ------------------- Fork data -------------------
const FORK_NODE = {
  identity: { id: 'fork-1', type: 'Fork', name: 'Conflicting definition of Knowledge' },
  structure: {
    pointer_key: 'concept-1',
    versions: [
      {
        object_id: 'concept-1-v1',
        origin_node: 'replica-a',
        created_at: '2026-08-01T10:00:00Z',
        structure: { description: 'Canonical representation of information' },
      },
      {
        object_id: 'concept-1-v2',
        origin_node: 'replica-b',
        created_at: '2026-08-01T10:05:00Z',
        structure: { description: 'A verified, immutable piece of knowledge' },
      },
    ],
  },
}

const FORK_EDGES = [
  { source: 'fork-1', target: 'concept-1', relation_type: 'resolves' },
]

/** Скрытые узлы, которые появляются при drill-down */
const HIDDEN_NODES = [
  {
    identity: { id: 'concept-4', type: 'Claim', name: 'Tampering detected by hash' },
    structure: {
      statement: 'Any tampering attempt changes the Merkle root hash.',
    },
  },
  {
    identity: { id: 'concept-5', type: 'Claim', name: 'Validation pipeline is deterministic' },
    structure: {
      statement: 'The same input always produces the same validation result.',
    },
  },
]

const HIDDEN_EDGES = [
  { source: 'concept-4', target: 'concept-3', relation_type: 'supports' },
  { source: 'concept-5', target: 'concept-1', relation_type: 'depends_on' },
]

/** Полный граф (начальные + скрытые + форк) */
function getFullGraph(): SubgraphResult {
  const base = getMockGraph()
  return {
    nodes: [...base.nodes, ...HIDDEN_NODES, FORK_NODE, ...PIPELINE_NODES],
    edges: [...base.edges, ...HIDDEN_EDGES, ...FORK_EDGES, ...PIPELINE_EDGES],
  }
}

// ------------------- Pipeline data -------------------
const PIPELINE_NODES = [
  {
    identity: { id: 'pipe-1', type: 'Claim', name: 'LLMs need canonical grounding' },
    structure: {
      statement: 'Language models benefit from a verifiable knowledge structure.',
      transition_log: [
        {
          agent: 'ResearcherAgent',
          action: 'researched',
          transitioned_to: 'awaiting_review',
          content_hash: 'abc123',
        },
      ],
      current_status: 'awaiting_review',
    },
  },
  {
    identity: { id: 'pipe-2', type: 'Claim', name: 'CKS reduces hallucinations' },
    structure: {
      statement: 'Canonical knowledge structures eliminate source hallucinations.',
      transition_log: [
        {
          agent: 'ResearcherAgent',
          action: 'researched',
          transitioned_to: 'awaiting_review',
          content_hash: 'def456',
        },
        {
          agent: 'ReviewerAgent',
          action: 'approved',
          transitioned_to: 'resolved',
          content_hash: 'def456',
        },
      ],
      current_status: 'resolved',
    },
  },
]

const PIPELINE_EDGES = [
  { source: 'pipe-1', target: 'concept-1', relation_type: 'depends_on' },
  { source: 'pipe-2', target: 'concept-3', relation_type: 'supports' },
]

/** Имитация вызова любого инструмента */
export async function mockCallTool(
  toolName: string,
  args: Record<string, unknown>,
): Promise<Record<string, unknown>> {
  if (toolName === 'query_subgraph') {
    return mockQuerySubgraph(
      (args.seed_ids as string[]) || [],
      (args.depth as number) || 1,
    )
  }
  throw new Error(`Unknown tool: ${toolName}`)
}

function mockQuerySubgraph(seedIds: string[], depth: number): SubgraphResult {
  if (seedIds.length === 0) return { nodes: [], edges: [] }

  const fullGraph = getFullGraph()
  const seed = seedIds[0]

  // Простая эмуляция: возвращаем seed + его непосредственные связи из полного графа
  const neighborIds = new Set<string>()
  for (const edge of fullGraph.edges) {
    if (edge.source === seed) neighborIds.add(edge.target)
    if (edge.target === seed) neighborIds.add(edge.source)
  }
  const allIds = new Set([seed, ...neighborIds])

  const nodes = fullGraph.nodes.filter((n) => allIds.has(n.identity.id))
  const edges = fullGraph.edges.filter(
    (e) => allIds.has(e.source) && allIds.has(e.target),
  )

  return { nodes, edges }
}