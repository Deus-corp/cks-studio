// Copyright (c) 2025 Deus Corp. Licensed under MIT.

import type { Edge } from '@xyflow/react'
import { useEffect, useState } from 'react'
import { useGraphStore } from '@/features/graph-explorer/graphExplorerStore'
import { useEvolveMutation } from '@/features/graph-explorer/useEvolveMutation'
import { addRelationOperation } from '@/services/mcpTools'

interface CreateRelationFormProps {
  sessionId: string
  onCreated?: (edge: Edge) => void
  onCancel?: () => void
}

/** id сгенерированной связи — см. аналогичный комментарий в
 *  CreateNodeForm.tsx::generateObjectId; уникальность в итоге
 *  проверяет бэкенд. */
function generateRelationId(relationType: string): string {
  const slug = relationType.toLowerCase().replace(/[^a-z0-9]+/g, '-') || 'rel'
  return `${slug}-${crypto.randomUUID().slice(0, 8)}`
}

/**
 * Форма создания связи. Участники выбираются кликом по узлам прямо на
 * канвасе (см. GraphCanvas + graphExplorerStore.relationDraft), а не
 * вводом id вручную — оба id уже существующих объектов, искать их по
 * памяти неудобно и чревато опечатками, которые add_relation просто
 * отклонит.
 *
 * Активирует relationDraft-режим при монтировании и снимает его при
 * размонтировании (в т.ч. при Cancel), чтобы канвас не оставался в
 * режиме выбора после закрытия формы.
 */
export function CreateRelationForm({
  sessionId,
  onCreated,
  onCancel,
}: CreateRelationFormProps) {
  const nodes = useGraphStore((s) => s.nodes)
  const relationDraft = useGraphStore((s) => s.relationDraft)
  const startRelationDraft = useGraphStore((s) => s.startRelationDraft)
  const cancelRelationDraft = useGraphStore((s) => s.cancelRelationDraft)
  const toggleRelationParticipant = useGraphStore(
    (s) => s.toggleRelationParticipant,
  )

  const [relationType, setRelationType] = useState('')
  const [relationName, setRelationName] = useState('')
  const [structureText, setStructureText] = useState('{}')
  const [structureError, setStructureError] = useState<string | null>(null)

  const { status, errorMessage, diagnostics, warnings, run, reset } =
    useEvolveMutation(sessionId)

  // Intentionally run only on mount/unmount — starting/cancelling the draft
  // on every relationDraft change would fight with toggleRelationParticipant.
  // biome-ignore lint/correctness/useExhaustiveDependencies: see comment above
  useEffect(() => {
    startRelationDraft()
    return () => cancelRelationDraft()
  }, [])

  const participants = relationDraft.participantIds
  const participantNodes = participants.map(
    (id) => nodes.find((n) => n.id === id) ?? null,
  )
  const isComplete = participants.length === 2
  const isSubmitDisabled =
    status === 'pending' || !isComplete || !relationType.trim()

  function handleRemoveParticipant(id: string) {
    toggleRelationParticipant(id)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setStructureError(null)

    if (participants.length !== 2) return
    const [source, target] = participants as [string, string]

    let structure: Record<string, unknown> = {}
    if (structureText.trim()) {
      try {
        const parsed = JSON.parse(structureText)
        if (
          typeof parsed !== 'object' ||
          parsed === null ||
          Array.isArray(parsed)
        ) {
          throw new Error('Structure must be a JSON object')
        }
        structure = parsed
      } catch (err) {
        setStructureError(err instanceof Error ? err.message : 'Invalid JSON')
        return
      }
    }

    const type = relationType.trim()
    const id = generateRelationId(type)
    const identity = { id, type: 'Relation', name: relationName.trim() || type }
    const operation = addRelationOperation(
      identity,
      [source, target],
      type,
      structure,
    )

    const optimisticEdge: Edge = {
      id,
      source,
      target,
      label: type,
      type: 'smoothstep',
      animated: false,
      style: { stroke: '#6b7280' },
    }

    const ok = await run(operation, { edge: optimisticEdge })
    if (ok) {
      onCreated?.(optimisticEdge)
      setRelationType('')
      setRelationName('')
      setStructureText('{}')
      reset()
      cancelRelationDraft()
    }
  }

  function handleCancel() {
    cancelRelationDraft()
    onCancel?.()
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="p-4 border-t border-gray-800 bg-gray-900 space-y-3"
    >
      <h3 className="text-sm font-semibold text-gray-200">New relation</h3>

      <div>
        <div className="block text-xs text-gray-500 mb-1">
          Participants ({participants.length}/2)
        </div>
        {participants.length === 0 && (
          <p className="text-xs text-gray-500 italic">
            Click a source node, then a target node on the canvas.
          </p>
        )}
        <ul className="space-y-1">
          {participantNodes.map((node, idx) =>
            node ? (
              <li
                key={node.id}
                className="flex items-center justify-between text-xs bg-gray-800 rounded px-2 py-1"
              >
                <span>
                  <span className="text-amber-400 font-semibold mr-1">
                    {idx === 0 ? 'source' : 'target'}:
                  </span>
                  <span className="text-gray-200">
                    {(node.data.label as string) ?? node.id}
                  </span>
                </span>
                <button
                  type="button"
                  onClick={() => handleRemoveParticipant(node.id)}
                  className="text-gray-500 hover:text-red-400"
                  aria-label={`Remove ${node.id} from relation`}
                >
                  ×
                </button>
              </li>
            ) : null,
          )}
        </ul>
        {participants.length === 1 && (
          <p className="text-xs text-gray-500 italic mt-1">
            Click a target node on the canvas.
          </p>
        )}
      </div>

      <div>
        <label
          htmlFor="new-relation-type"
          className="block text-xs text-gray-500 mb-1"
        >
          Relation type
        </label>
        <input
          id="new-relation-type"
          type="text"
          value={relationType}
          onChange={(e) => setRelationType(e.target.value)}
          placeholder="e.g. derives, supports, contradicts"
          className="w-full bg-gray-800 border border-gray-700 rounded px-2 py-1 text-sm text-gray-200"
          required
        />
      </div>

      <div>
        <label
          htmlFor="new-relation-name"
          className="block text-xs text-gray-500 mb-1"
        >
          Name (optional, defaults to type)
        </label>
        <input
          id="new-relation-name"
          type="text"
          value={relationName}
          onChange={(e) => setRelationName(e.target.value)}
          className="w-full bg-gray-800 border border-gray-700 rounded px-2 py-1 text-sm text-gray-200"
        />
      </div>

      <div>
        <label
          htmlFor="new-relation-structure"
          className="block text-xs text-gray-500 mb-1"
        >
          Structure (JSON, optional)
        </label>
        <textarea
          id="new-relation-structure"
          value={structureText}
          onChange={(e) => setStructureText(e.target.value)}
          rows={4}
          className="w-full bg-gray-800 border border-gray-700 rounded px-2 py-1 text-xs font-mono text-gray-200"
        />
        {structureError && (
          <p className="text-red-400 text-xs mt-1">{structureError}</p>
        )}
      </div>

      {errorMessage && <p className="text-red-400 text-xs">{errorMessage}</p>}

      {diagnostics.length > 0 && (
        <ul className="space-y-1">
          {diagnostics.map((d) => (
            <li
              key={`${d.code}-${d.location ?? ''}`}
              className="text-xs bg-red-950/50 border border-red-900 rounded px-2 py-1"
            >
              <span className="uppercase text-red-400 mr-1">{d.severity}</span>
              <span className="text-red-200">{d.message}</span>
              {d.location && (
                <span className="text-red-400/70"> ({d.location})</span>
              )}
            </li>
          ))}
        </ul>
      )}

      {warnings.length > 0 && (
        <ul className="space-y-1">
          {warnings.map((w) => (
            <li
              key={`${w.code}-${w.location ?? ''}`}
              className="text-xs bg-amber-950/50 border border-amber-900 rounded px-2 py-1"
            >
              <span className="uppercase text-amber-400 mr-1">
                {w.severity}
              </span>
              <span className="text-amber-200">{w.message}</span>
            </li>
          ))}
        </ul>
      )}

      <div className="flex gap-2">
        <button
          type="submit"
          disabled={isSubmitDisabled}
          className="flex-1 rounded bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {status === 'pending' ? 'Creating…' : 'Create'}
        </button>
        <button
          type="button"
          onClick={handleCancel}
          className="rounded bg-gray-700 px-3 py-1.5 text-sm text-gray-300 hover:bg-gray-600"
        >
          Cancel
        </button>
      </div>
    </form>
  )
}
