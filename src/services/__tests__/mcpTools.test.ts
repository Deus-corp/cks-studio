import { describe, expect, it, vi } from 'vitest'
import type { ExecutedToolCall } from '../mcpTools'

const { callToolMock } = vi.hoisted(() => ({
  callToolMock: vi.fn(),
}))

vi.mock('../mcpClient', () => ({
  callTool: callToolMock,
}))

const { normalizeCompactSubgraphResponse, toolCallsMutatedGraph, cloneGraph } =
  await import('../mcpTools')

describe('normalizeCompactSubgraphResponse', () => {
  it('unwraps nodes/edges from the real query_subgraph_tool compact_mode shape', () => {
    const raw = {
      session_id: 's1',
      subgraph: {
        nodes: [
          {
            identity: { id: 'a1', type: 'Claim', name: 'Claim A' },
            structure: { status: 'active' },
          },
          {
            identity: { id: 'a2', type: 'Definition', name: 'Def A' },
            structure: {},
          },
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

describe('toolCallsMutatedGraph', () => {
  const call = (name: string, is_error = false): ExecutedToolCall => ({
    name,
    arguments: {},
    result: {},
    is_error,
  })

  it('is false when there are no tool calls', () => {
    expect(toolCallsMutatedGraph([])).toBe(false)
  })

  it('is false when only non-mutating tools were called', () => {
    expect(
      toolCallsMutatedGraph([call('query_subgraph'), call('list_agents')]),
    ).toBe(false)
  })

  it('is true when a successful evolve_knowledge call is present', () => {
    expect(
      toolCallsMutatedGraph([call('query_subgraph'), call('evolve_knowledge')]),
    ).toBe(true)
  })

  it('ignores a mutating tool call that failed', () => {
    expect(toolCallsMutatedGraph([call('evolve_knowledge', true)])).toBe(false)
  })

  it('is true for every mutating tool name in the set', () => {
    for (const name of [
      'evolve_knowledge',
      'revert_version',
      'merge_branch',
      'merge_knowledge',
      'resolve_contradiction',
      'resolve_temporal_conflict',
      'resolve_gossip_conflict',
      'refresh_verification',
    ]) {
      expect(toolCallsMutatedGraph([call(name)])).toBe(true)
    }
  })
})

describe('cloneGraph', () => {
  it('calls clone_graph with only the provided params, mapped to snake_case', async () => {
    callToolMock.mockResolvedValueOnce({
      session_id: 'sess-new',
      version_id: 'v1',
      source_session_id: 'sess-old',
      imported_objects: 3,
      imported_relations: 2,
    })

    const result = await cloneGraph({ graphName: 'my-graph' })

    expect(callToolMock).toHaveBeenCalledWith('clone_graph', {
      graph_name: 'my-graph',
    })
    expect(result.session_id).toBe('sess-new')
    expect(result.imported_objects).toBe(3)
  })

  it('maps all optional params to their snake_case tool arguments', async () => {
    callToolMock.mockResolvedValueOnce({
      session_id: 'sess-new',
      version_id: null,
      source_session_id: 'sess-old',
      imported_objects: 0,
      imported_relations: 0,
    })

    await cloneGraph({
      graphName: 'my-graph',
      sourceSessionId: 'sess-old',
      targetSessionId: 'sess-target',
      copyName: 'my-graph-copy',
    })

    expect(callToolMock).toHaveBeenCalledWith('clone_graph', {
      graph_name: 'my-graph',
      source_session_id: 'sess-old',
      target_session_id: 'sess-target',
      copy_name: 'my-graph-copy',
    })
  })

  it('throws with the message from a business-error response', async () => {
    callToolMock.mockResolvedValueOnce({
      error: 'not_found',
      message: 'Graph "missing" is not registered',
    })

    await expect(cloneGraph({ graphName: 'missing' })).rejects.toThrow(
      'Graph "missing" is not registered',
    )
  })

  it('falls back to the error code when no message is provided', async () => {
    callToolMock.mockResolvedValueOnce({ error: 'not_found' })

    await expect(cloneGraph({ graphName: 'missing' })).rejects.toThrow(
      'not_found',
    )
  })
})
