// Copyright (c) 2025 Deus Corp. Licensed under MIT.

/**
 * Mock MCP client for the static demo (public/demo.html, src/demo.tsx).
 *
 * The demo is served from GitHub Pages with no cks-mcp server behind it,
 * so this module stands in for src/services/mcpClient.ts's callTool():
 * same signature, no network. It only knows how to answer with the single
 * bundled ecosystem graph (scripts/cks-ecosystem.json, copied to
 * src/services/cks-ecosystem.demo.json so Vite can import it as JSON).
 * Everything else responds with the same shape a real "unsupported tool"
 * error would have, so calling code that already handles MCP errors
 * doesn't need a demo-specific branch.
 */
import type { CksObject } from '@/shared/types/graph'
// Bundled at build time by Vite's native JSON import support -- no copy
// needed, the file already lives in scripts/ at the repo root.
import ecosystemGraph from '../../scripts/cks-ecosystem.json'

interface EcosystemFile {
  objects: CksObject[]
}

const GRAPH = ecosystemGraph as unknown as EcosystemFile

const DEMO_SESSION_ID = 'demo-ecosystem'
const DEMO_GRAPH_NAME = 'cks-ecosystem'

function notAvailable(toolName: string): Record<string, unknown> {
  return {
    error: `Tool '${toolName}' is not available in the static demo. Run cks-mcp locally and connect the studio for full functionality.`,
  }
}

function serializeKnowledge(): Record<string, unknown> {
  return { serialized: JSON.stringify({ objects: GRAPH.objects }) }
}

/** Mirrors query_subgraph_tool's compact_mode response shape (see
 *  mcpTools.ts normalizeCompactSubgraphResponse): a BFS from seed_ids out
 *  to `depth` hops, restricted to the single bundled graph.
 *
 *  With no seed_ids (the initial-load case some callers use instead of
 *  serialize_knowledge), there's nothing to BFS from, so fall back to
 *  returning the entire bundled graph as one subgraph -- matching what a
 *  real query_subgraph call with an empty seed set would be pointless to
 *  do, but keeping this tool robust to either call shape. */
function querySubgraph(args: Record<string, unknown>): Record<string, unknown> {
  const seedIds = Array.isArray(args.seed_ids)
    ? (args.seed_ids as string[])
    : []

  const relations = GRAPH.objects.filter(
    (obj) => obj.identity.type === 'Relation',
  )

  if (seedIds.length === 0) {
    const nodes = GRAPH.objects.filter(
      (obj) => obj.identity.type !== 'Relation',
    )
    const edges = relations.map((rel) => {
      const s = rel.structure as Record<string, unknown>
      return {
        source: s.source,
        target: s.target,
        type: s.relation_type ?? 'related',
      }
    })
    return { subgraph: { nodes, edges } }
  }

  const depth = typeof args.depth === 'number' ? args.depth : 1

  const byId = new Map(GRAPH.objects.map((obj) => [obj.identity.id, obj]))

  const edgesFor = (id: string) =>
    relations.filter((rel) => {
      const s = rel.structure as Record<string, unknown>
      return s.source === id || s.target === id
    })

  const visited = new Set<string>(seedIds)
  let frontier = new Set<string>(seedIds)
  const collectedEdges: CksObject[] = []

  for (let hop = 0; hop < depth; hop++) {
    const next = new Set<string>()
    for (const id of frontier) {
      for (const rel of edgesFor(id)) {
        collectedEdges.push(rel)
        const s = rel.structure as Record<string, unknown>
        const other = s.source === id ? s.target : s.source
        if (typeof other === 'string' && !visited.has(other)) {
          visited.add(other)
          next.add(other)
        }
      }
    }
    frontier = next
  }

  const nodes = [...visited]
    .map((id) => byId.get(id))
    .filter((n): n is CksObject => n != null && n.identity.type !== 'Relation')

  const edges = collectedEdges.map((rel) => {
    const s = rel.structure as Record<string, unknown>
    return {
      source: s.source,
      target: s.target,
      type: s.relation_type ?? 'related',
    }
  })

  return { subgraph: { nodes, edges } }
}

function listGraphs(): Record<string, unknown> {
  return {
    graphs: [
      {
        name: DEMO_GRAPH_NAME,
        session_id: DEMO_SESSION_ID,
        object_count: GRAPH.objects.length,
        updated_at: new Date().toISOString(),
      },
    ],
  }
}

export async function callTool(
  toolName: string,
  args: Record<string, unknown>,
): Promise<Record<string, unknown>> {
  switch (toolName) {
    case 'serialize_knowledge':
      return serializeKnowledge()
    case 'query_subgraph':
      return querySubgraph(args)
    case 'list_graphs':
    case 'search_graphs':
      return listGraphs()
    case 'check_graph_health':
      return { health_score: 1, checks: [], graph: DEMO_GRAPH_NAME }
    default:
      return notAvailable(toolName)
  }
}

export const DEMO_SESSION = {
  serverUrl: 'demo://static',
  sessionId: DEMO_SESSION_ID,
}

export const DEMO_GRAPH_OBJECT_COUNT = GRAPH.objects.length

/** Component objects (identity.type === 'Component') from the bundled
 *  cks-ecosystem graph, e.g. cks-core / cks-runtime / cks-mcp / cks-studio
 *  with their declared version -- used by the demo Settings page so the
 *  "component versions" block shows real data pulled from the graph
 *  instead of hand-maintained numbers that would drift from it. */
export interface DemoComponentVersion {
  id: string
  name: string
  description: string | null
  version: string | null
}

export function listComponentVersions(): DemoComponentVersion[] {
  return GRAPH.objects
    .filter((obj) => obj.identity.type === 'Component')
    .map((obj) => {
      const s = obj.structure as Record<string, unknown>
      return {
        id: obj.identity.id,
        name: obj.identity.name,
        description: typeof s.description === 'string' ? s.description : null,
        version: typeof s.version === 'string' ? s.version : null,
      }
    })
    .filter((c) => c.version !== null)
}
