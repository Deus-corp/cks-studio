// Copyright (c) 2026 Deus Corp. Licensed under MIT.

import { useEffect, useState } from 'react'
import { getFullGraph, linkGraphs, listGraphs } from '@/services/mcpTools'
import type { GraphRegistryEntry } from '@/shared/types/graph'

interface CrossGraphLinkFormProps {
  sessionId: string
  objectId: string
  objectLabel?: string
  onLinked?: () => void
  onCancel?: () => void
}

/**
 * Links the currently selected object (in the connected session) to an
 * object in another *registered* graph, via link_graphs (see
 * cks_mcp/tools/link_graphs/handler.py). The target graph is picked from
 * the registry (list_graphs) rather than typed as a raw session id, then
 * its objects are loaded (getFullGraph) so the target object can be
 * picked by name instead of by id.
 */
export function CrossGraphLinkForm({
  sessionId,
  objectId,
  objectLabel,
  onLinked,
  onCancel,
}: CrossGraphLinkFormProps) {
  const [graphs, setGraphs] = useState<GraphRegistryEntry[]>([])
  const [graphsError, setGraphsError] = useState<string | null>(null)
  const [targetGraphName, setTargetGraphName] = useState('')

  const [targetObjects, setTargetObjects] = useState<
    { id: string; label: string }[]
  >([])
  const [targetObjectId, setTargetObjectId] = useState('')
  const [isLoadingObjects, setIsLoadingObjects] = useState(false)
  const [objectsError, setObjectsError] = useState<string | null>(null)

  const [relationType, setRelationType] = useState('')
  const [relationName, setRelationName] = useState('')
  const [isLinking, setIsLinking] = useState(false)
  const [linkError, setLinkError] = useState<string | null>(null)
  const [linkSuccess, setLinkSuccess] = useState<string | null>(null)

  // Load the registry once on mount, so the target-graph dropdown is
  // populated without requiring the user to know a session id by heart
  // (the whole point of linking via registry name instead of raw ids).
  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const result = await listGraphs({ publicOnly: false })
        if (!cancelled) {
          // Exclude the current session's own graph -- linking a graph
          // to itself isn't a cross-graph link, and add_relation (the
          // in-session relation form) already covers same-graph links.
          setGraphs(result.filter((g) => g.session_id !== sessionId))
        }
      } catch (e) {
        if (!cancelled) {
          setGraphsError(e instanceof Error ? e.message : 'Unknown error')
        }
      }
    })()
    return () => {
      cancelled = true
    }
    // sessionId intentionally not in deps beyond the initial filter --
    // re-running this whenever it changes would refetch on every canvas
    // interaction; the registry itself only needs to load once per open.
  }, [sessionId])

  // Reload target objects whenever the target graph changes.
  useEffect(() => {
    if (!targetGraphName) {
      setTargetObjects([])
      setTargetObjectId('')
      return
    }
    const graph = graphs.find((g) => g.name === targetGraphName)
    if (!graph) return
    let cancelled = false
    setIsLoadingObjects(true)
    setObjectsError(null)
    setTargetObjectId('')
    ;(async () => {
      try {
        const subgraph = await getFullGraph(graph.session_id)
        if (!cancelled) {
          setTargetObjects(
            subgraph.nodes.map((n) => ({
              id: n.identity.id,
              label: n.identity.name || n.identity.id,
            })),
          )
        }
      } catch (e) {
        if (!cancelled) {
          setObjectsError(e instanceof Error ? e.message : 'Unknown error')
        }
      } finally {
        if (!cancelled) setIsLoadingObjects(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [targetGraphName, graphs])

  const isSubmitDisabled =
    isLinking || !targetGraphName || !targetObjectId || !relationType.trim()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const graph = graphs.find((g) => g.name === targetGraphName)
    if (!graph || !targetObjectId) return

    setIsLinking(true)
    setLinkError(null)
    setLinkSuccess(null)
    try {
      const result = await linkGraphs({
        graphA: { sessionId },
        graphB: { sessionId: graph.session_id },
        objectAId: objectId,
        objectBId: targetObjectId,
        relationType: relationType.trim(),
        relationName: relationName.trim() || undefined,
      })
      setLinkSuccess(`Linked as ${result.relation_id}`)
      onLinked?.()
    } catch (err) {
      setLinkError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setIsLinking(false)
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="p-4 border-t border-border-subtle bg-surface-1 space-y-3"
    >
      <h3 className="text-sm font-semibold text-text-primary">
        Cross-graph link
      </h3>
      <p className="text-xs text-text-tertiary">
        From{' '}
        <span className="text-text-primary">{objectLabel ?? objectId}</span> in
        this graph to an object in another registered graph.
      </p>

      {graphsError && <p className="text-xs text-danger">{graphsError}</p>}
      {!graphsError && graphs.length === 0 && (
        <p className="text-xs text-text-tertiary italic">
          No other registered graphs found. Register a graph via register_graph
          first.
        </p>
      )}

      <div>
        <label
          htmlFor="cross-link-target-graph"
          className="block text-xs text-text-tertiary mb-1"
        >
          Target graph
        </label>
        <select
          id="cross-link-target-graph"
          value={targetGraphName}
          onChange={(e) => setTargetGraphName(e.target.value)}
          className="w-full bg-surface-2 border border-border rounded px-2 py-1 text-sm text-text-primary"
          disabled={graphs.length === 0}
        >
          <option value="">Select a graph…</option>
          {graphs.map((g) => (
            <option key={g.name} value={g.name}>
              {g.name}
            </option>
          ))}
        </select>
      </div>

      {targetGraphName && (
        <div>
          <label
            htmlFor="cross-link-target-object"
            className="block text-xs text-text-tertiary mb-1"
          >
            Target object
          </label>
          {isLoadingObjects && (
            <p className="text-xs text-text-tertiary">Loading objects…</p>
          )}
          {objectsError && (
            <p className="text-xs text-danger">{objectsError}</p>
          )}
          {!isLoadingObjects && !objectsError && (
            <select
              id="cross-link-target-object"
              value={targetObjectId}
              onChange={(e) => setTargetObjectId(e.target.value)}
              className="w-full bg-surface-2 border border-border rounded px-2 py-1 text-sm text-text-primary"
              disabled={targetObjects.length === 0}
            >
              <option value="">Select an object…</option>
              {targetObjects.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.label} ({o.id})
                </option>
              ))}
            </select>
          )}
        </div>
      )}

      <div>
        <label
          htmlFor="cross-link-relation-type"
          className="block text-xs text-text-tertiary mb-1"
        >
          Relation type
        </label>
        <input
          id="cross-link-relation-type"
          type="text"
          value={relationType}
          onChange={(e) => setRelationType(e.target.value)}
          placeholder="e.g. depends_on, references"
          className="w-full bg-surface-2 border border-border rounded px-2 py-1 text-sm text-text-primary placeholder:text-text-tertiary"
          required
        />
      </div>

      <div>
        <label
          htmlFor="cross-link-relation-name"
          className="block text-xs text-text-tertiary mb-1"
        >
          Name (optional, defaults to type)
        </label>
        <input
          id="cross-link-relation-name"
          type="text"
          value={relationName}
          onChange={(e) => setRelationName(e.target.value)}
          className="w-full bg-surface-2 border border-border rounded px-2 py-1 text-sm text-text-primary"
        />
      </div>

      {linkError && <p className="text-xs text-danger">{linkError}</p>}
      {linkSuccess && <p className="text-xs text-success">{linkSuccess}</p>}

      <div className="flex gap-2">
        <button
          type="submit"
          disabled={isSubmitDisabled}
          className="flex-1 rounded bg-accent px-3 py-1.5 text-sm font-medium text-white hover:bg-accent-strong disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isLinking ? 'Linking…' : 'Create link'}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="rounded bg-surface-3 px-3 py-1.5 text-sm text-text-primary hover:bg-border"
        >
          Cancel
        </button>
      </div>
    </form>
  )
}
