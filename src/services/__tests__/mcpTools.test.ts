// Copyright (c) 2025 Deus Corp. Licensed under MIT.

import { describe, expect, it } from 'vitest'
import { normalizeCompactSubgraphResponse } from '../mcpTools'

describe('normalizeCompactSubgraphResponse', () => {
  it('unwraps nodes/edges from the real query_subgraph_tool compact_mode shape', () => {
    // Форма скопирована из cks-mcp src/cks_mcp/tools/query_subgraph/handler.py
    const raw = {
      session_id: 's1',
      subgraph: {
        nodes: [
          {
            id: 'a1',
            type: 'Claim',
            name: 'Claim A',
            props: { status: 'active' },
          },
          { id: 'a2', type: 'Definition', name: 'Def A', props: {} },
        ],
        edges: [{ source: 'a1', target: 'a2', type: 'depends_on' }],
      },
      subgraph_root_hash: 'hash',
      total_found_nodes: 2,
      returned_nodes: 2,
      is_truncated: false,
      truncation_reason: null,
      suggested_next_seed: null,
    }

    const result = normalizeCompactSubgraphResponse(raw)

    expect(result.nodes).toEqual([
      {
        identity: { id: 'a1', type: 'Claim', name: 'Claim A' },
        structure: { status: 'active' },
      },
      {
        identity: { id: 'a2', type: 'Definition', name: 'Def A' },
        structure: {},
      },
    ])
    expect(result.edges).toEqual([
      { source: 'a1', target: 'a2', relation_type: 'depends_on' },
    ])
  })

  it('drops edges with a missing source or target (dangling relation participants)', () => {
    const raw = {
      subgraph: {
        nodes: [],
        edges: [
          { source: 'a1', target: null, type: 'depends_on' },
          { source: null, target: 'a2', type: 'depends_on' },
          { source: 'a1', target: 'a2', type: 'depends_on' },
        ],
      },
    }
    const result = normalizeCompactSubgraphResponse(raw)
    expect(result.edges).toHaveLength(1)
  })

  it('returns empty nodes/edges when subgraph key is entirely missing', () => {
    expect(normalizeCompactSubgraphResponse({})).toEqual({
      nodes: [],
      edges: [],
    })
  })
})
