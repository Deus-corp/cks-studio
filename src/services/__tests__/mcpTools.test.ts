import { describe, expect, it, vi } from 'vitest'
import type { ExecutedToolCall } from '../mcpTools'

const { callToolMock } = vi.hoisted(() => ({
  callToolMock: vi.fn(),
}))

vi.mock('../mcpClient', () => ({
  callTool: callToolMock,
}))

const {
  normalizeCompactSubgraphResponse,
  toolCallsMutatedGraph,
  cloneGraph,
  compareGraphs,
  mergeGraphs,
  linkGraphs,
  updateGraphLifecycle,
  unregisterGraph,
  listDeadLetteredConflicts,
  explainDiff,
} = await import('../mcpTools')

describe('explainDiff', () => {
  it('returns the response as-is on a well-formed success shape', async () => {
    callToolMock.mockResolvedValueOnce({
      session_id: 's1',
      base_version_id: 'v1',
      summary: 'Added 1 object(s)',
      details: {
        added_objects: [{ id: 'a', action: 'added', type: 'Claim', name: 'A' }],
        removed_objects: [],
        modified_objects: [],
        added_relations: [],
        removed_relations: [],
        modified_relations: [],
        relinked_relations: [],
        renamed_objects: [],
        added_inference_steps: [],
      },
    })

    const result = await explainDiff('s1', 'v1')

    expect(result.details.added_objects).toHaveLength(1)
    expect(result.summary).toBe('Added 1 object(s)')
  })

  it('passes an {error} business result through untouched', async () => {
    callToolMock.mockResolvedValueOnce({
      error: 'session_not_found',
      message: "Session 's1' not found.",
    })

    const result = (await explainDiff('s1', 'v1')) as unknown as {
      error: string
    }

    expect(result.error).toBe('session_not_found')
  })

  it('normalizes missing `details` fields to empty arrays instead of undefined (bug #2)', async () => {
    // e.g. a partial/unexpected response shape -- must not let
    // `diff.details.added_objects.length` reach the caller as
    // undefined and crash the Diff page.
    callToolMock.mockResolvedValueOnce({
      session_id: 's1',
      base_version_id: 'v1',
      summary: 'No changes detected.',
      details: {},
    })

    const result = await explainDiff('s1', 'v1')

    expect(result.details.added_objects).toEqual([])
    expect(result.details.removed_objects).toEqual([])
    expect(result.details.renamed_objects).toEqual([])
    expect(result.details.added_inference_steps).toEqual([])
  })

  it('normalizes an entirely missing `details` object', async () => {
    callToolMock.mockResolvedValueOnce({
      session_id: 's1',
      base_version_id: 'v1',
      summary: 'No changes detected.',
    })

    const result = await explainDiff('s1', 'v1')

    expect(result.details.added_objects).toEqual([])
    expect(result.details.modified_relations).toEqual([])
  })
})

describe('listDeadLetteredConflicts', () => {
  it('returns tasks/count/supported as-is for a well-formed response', async () => {
    callToolMock.mockResolvedValueOnce({
      tasks: [
        {
          task_id: 1,
          task_type: 'gossip_conflict',
          session_id: 's1',
          payload: {},
          retry_count: 0,
        },
      ],
      count: 1,
      supported: true,
    })

    const result = await listDeadLetteredConflicts()

    expect(result.tasks).toHaveLength(1)
    expect(result.count).toBe(1)
    expect(result.supported).toBe(true)
  })

  it('normalizes a missing `tasks` field to an empty array instead of undefined', async () => {
    // e.g. a tool-level error object, or a backend response that omits
    // `tasks` -- must not propagate `undefined` to callers (DeadLetterPanel
    // does `tasks.map(...)` directly on this).
    callToolMock.mockResolvedValueOnce({ supported: true })

    const result = await listDeadLetteredConflicts()

    expect(result.tasks).toEqual([])
    expect(result.count).toBe(0)
    expect(result.supported).toBe(true)
  })

  it('normalizes `tasks: null` to an empty array', async () => {
    callToolMock.mockResolvedValueOnce({
      tasks: null,
      count: 0,
      supported: true,
    })

    const result = await listDeadLetteredConflicts()

    expect(result.tasks).toEqual([])
  })

  it('defaults `supported` to true when missing', async () => {
    callToolMock.mockResolvedValueOnce({ tasks: [] })

    const result = await listDeadLetteredConflicts()

    expect(result.supported).toBe(true)
  })
})

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

describe('compareGraphs', () => {
  it('maps both sides by name to compare_graphs, defaulting includeRelations to true', async () => {
    callToolMock.mockResolvedValueOnce({
      graph_a: 'graph-a',
      graph_b: 'graph-b',
      graph_a_session_id: 'sess-a',
      graph_b_session_id: 'sess-b',
      shared_object_count: 1,
      only_in_a_count: 0,
      only_in_b_count: 0,
      shared_object_ids: ['obj-1'],
      only_in_a: [],
      only_in_b: [],
      differences: [],
    })

    const result = await compareGraphs({
      graphA: { graphName: 'graph-a' },
      graphB: { graphName: 'graph-b' },
    })

    expect(callToolMock).toHaveBeenCalledWith('compare_graphs', {
      graph_a_name: 'graph-a',
      graph_b_name: 'graph-b',
      include_relations: true,
    })
    expect(result.shared_object_count).toBe(1)
  })

  it('prefers session ids over names when both are given, per side', async () => {
    callToolMock.mockResolvedValueOnce({
      graph_a: 'sess-a',
      graph_b: 'sess-b',
      graph_a_session_id: 'sess-a',
      graph_b_session_id: 'sess-b',
      shared_object_count: 0,
      only_in_a_count: 0,
      only_in_b_count: 0,
      shared_object_ids: [],
      only_in_a: [],
      only_in_b: [],
      differences: [],
    })

    await compareGraphs({
      graphA: { graphName: 'graph-a', sessionId: 'sess-a' },
      graphB: { graphName: 'graph-b', sessionId: 'sess-b' },
      includeRelations: false,
    })

    expect(callToolMock).toHaveBeenCalledWith('compare_graphs', {
      graph_a_name: 'graph-a',
      graph_a_session_id: 'sess-a',
      graph_b_name: 'graph-b',
      graph_b_session_id: 'sess-b',
      include_relations: false,
    })
  })
})

describe('mergeGraphs', () => {
  it('maps params to merge_graphs and returns the merged result as-is', async () => {
    callToolMock.mockResolvedValueOnce({
      merged: true,
      session_id: 'sess-merged',
      version_id: 'v1',
      object_count: 5,
    })

    const result = await mergeGraphs({
      graphA: { graphName: 'graph-a' },
      graphB: { graphName: 'graph-b' },
      registerAs: 'merged-graph',
    })

    expect(callToolMock).toHaveBeenCalledWith('merge_graphs', {
      graph_a_name: 'graph-a',
      graph_b_name: 'graph-b',
      register_as: 'merged-graph',
    })
    expect(result).toEqual({
      merged: true,
      session_id: 'sess-merged',
      version_id: 'v1',
      object_count: 5,
    })
  })

  it('passes base graph and resolutions through when provided', async () => {
    callToolMock.mockResolvedValueOnce({ merged: true, session_id: 's1' })

    await mergeGraphs({
      graphA: { sessionId: 'sess-a' },
      graphB: { sessionId: 'sess-b' },
      base: { graphName: 'base-graph' },
      resolutions: { 'obj-1': 'branch_a' },
    })

    expect(callToolMock).toHaveBeenCalledWith('merge_graphs', {
      graph_a_session_id: 'sess-a',
      graph_b_session_id: 'sess-b',
      base_graph_name: 'base-graph',
      resolutions: { 'obj-1': 'branch_a' },
    })
  })

  it('returns the result unthrown when merged is false with conflicts', async () => {
    callToolMock.mockResolvedValueOnce({
      merged: false,
      message: 'Merge conflict detected.',
      conflicts: [{ object_id: 'obj-1', target_diff: {}, source_diff: {} }],
    })

    const result = await mergeGraphs({
      graphA: { graphName: 'graph-a' },
      graphB: { graphName: 'graph-b' },
    })

    expect(result.merged).toBe(false)
    expect(result.conflicts).toHaveLength(1)
  })

  it('throws when the response has neither merged:true nor merged:false', async () => {
    callToolMock.mockResolvedValueOnce({
      error: 'invalid_resolutions',
      message: "Invalid 'resolutions' entry: bad JSON",
    })

    await expect(
      mergeGraphs({
        graphA: { graphName: 'graph-a' },
        graphB: { graphName: 'graph-b' },
      }),
    ).rejects.toThrow("Invalid 'resolutions' entry: bad JSON")
  })
})

describe('linkGraphs', () => {
  it('maps params to link_graphs, snake_cased, and returns the result', async () => {
    callToolMock.mockResolvedValueOnce({
      linked: true,
      relation_id: 'cross-link:graph-a:obj-a:graph-b:obj-b:depends_on',
      graph_a_version: 'va',
      graph_b_version: 'vb',
    })

    const result = await linkGraphs({
      graphA: { graphName: 'graph-a' },
      graphB: { graphName: 'graph-b' },
      objectAId: 'obj-a',
      objectBId: 'obj-b',
      relationType: 'depends_on',
    })

    expect(callToolMock).toHaveBeenCalledWith('link_graphs', {
      graph_a_name: 'graph-a',
      graph_b_name: 'graph-b',
      object_a_id: 'obj-a',
      object_b_id: 'obj-b',
      relation_type: 'depends_on',
    })
    expect(result.linked).toBe(true)
    expect(result.relation_id).toBe(
      'cross-link:graph-a:obj-a:graph-b:obj-b:depends_on',
    )
  })

  it('includes relation_name only when provided', async () => {
    callToolMock.mockResolvedValueOnce({
      linked: true,
      relation_id: 'id',
      graph_a_version: 'va',
      graph_b_version: 'vb',
    })

    await linkGraphs({
      graphA: { sessionId: 'sess-a' },
      graphB: { sessionId: 'sess-b' },
      objectAId: 'obj-a',
      objectBId: 'obj-b',
      relationType: 'references',
      relationName: 'My Link',
    })

    expect(callToolMock).toHaveBeenCalledWith('link_graphs', {
      graph_a_session_id: 'sess-a',
      graph_b_session_id: 'sess-b',
      object_a_id: 'obj-a',
      object_b_id: 'obj-b',
      relation_type: 'references',
      relation_name: 'My Link',
    })
  })

  it('throws with the message from a business-error response', async () => {
    callToolMock.mockResolvedValueOnce({
      error: 'object_not_found',
      message: "Object 'obj-a' was not found in graph A (graph-a).",
    })

    await expect(
      linkGraphs({
        graphA: { graphName: 'graph-a' },
        graphB: { graphName: 'graph-b' },
        objectAId: 'obj-a',
        objectBId: 'obj-b',
        relationType: 'depends_on',
      }),
    ).rejects.toThrow("Object 'obj-a' was not found in graph A (graph-a).")
  })

  it('surfaces partial_failure responses via the same error path', async () => {
    callToolMock.mockResolvedValueOnce({
      error: 'unverified_provenance',
      message: 'Cannot link (graph A already updated; graph B failed).',
      partial_failure: true,
    })

    await expect(
      linkGraphs({
        graphA: { graphName: 'graph-a' },
        graphB: { graphName: 'graph-b' },
        objectAId: 'obj-a',
        objectBId: 'obj-b',
        relationType: 'depends_on',
      }),
    ).rejects.toThrow('Cannot link (graph A already updated; graph B failed).')
  })
})

describe('updateGraphLifecycle', () => {
  it('calls update_graph_lifecycle with name/state and returns a success result', async () => {
    callToolMock.mockResolvedValueOnce({
      updated: true,
      name: 'my-graph',
      previous_state: 'draft',
      new_state: 'published',
    })

    const result = await updateGraphLifecycle({
      name: 'my-graph',
      state: 'published',
    })

    expect(callToolMock).toHaveBeenCalledWith('update_graph_lifecycle', {
      name: 'my-graph',
      state: 'published',
    })
    expect(result).toEqual({
      updated: true,
      name: 'my-graph',
      previous_state: 'draft',
      new_state: 'published',
    })
  })

  it('returns the no-op shape without throwing when already in the requested state', async () => {
    callToolMock.mockResolvedValueOnce({
      updated: false,
      reason: 'already in requested state',
      name: 'my-graph',
      previous_state: 'active',
      new_state: 'active',
    })

    const result = await updateGraphLifecycle({
      name: 'my-graph',
      state: 'active',
    })

    expect('error' in result).toBe(false)
    if (!('error' in result)) {
      expect(result.updated).toBe(false)
      if (!result.updated) {
        expect(result.reason).toBe('already in requested state')
      }
    }
  })

  it('returns the structured error shape without throwing on a disallowed transition', async () => {
    callToolMock.mockResolvedValueOnce({
      error: 'invalid_state_transition',
      message: "Graph 'my-graph' cannot transition from 'draft' to 'active'.",
      name: 'my-graph',
      previous_state: 'draft',
      requested_state: 'active',
      allowed: ['published', 'archived'],
    })

    const result = await updateGraphLifecycle({
      name: 'my-graph',
      state: 'active',
    })

    expect('error' in result && result.error).toBe('invalid_state_transition')
    if ('allowed' in result) {
      expect(result.allowed).toEqual(['published', 'archived'])
    }
  })
})

describe('unregisterGraph', () => {
  it('calls unregister_graph with name and returns a success result', async () => {
    callToolMock.mockResolvedValueOnce({
      unregistered: true,
      name: 'my-graph',
    })

    const result = await unregisterGraph({ name: 'my-graph' })

    expect(callToolMock).toHaveBeenCalledWith('unregister_graph', {
      name: 'my-graph',
    })
    expect(result).toEqual({ unregistered: true, name: 'my-graph' })
  })

  it('returns the structured error shape without throwing when the graph is not found', async () => {
    callToolMock.mockResolvedValueOnce({
      error: 'graph_not_found',
      message: "No graph is registered under name 'nope'.",
    })

    const result = await unregisterGraph({ name: 'nope' })

    expect('error' in result && result.error).toBe('graph_not_found')
  })
})
