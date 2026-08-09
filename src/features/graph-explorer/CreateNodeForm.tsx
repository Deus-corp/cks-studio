// Copyright (c) 2025 Deus Corp. Licensed under MIT.

import type { Node } from '@xyflow/react'
import { useState } from 'react'
import { useEvolveMutation } from '@/features/graph-explorer/useEvolveMutation'
import { addObjectOperation } from '@/services/mcpTools'
import { NODE_TYPE_COLORS } from '@/shared/constants/nodeTypes'

interface CreateNodeFormProps {
  sessionId: string
  /** Позиция для нового узла в канвасе (например центр текущего вьюпорта). */
  position?: { x: number; y: number }
  onCreated?: (node: Node) => void
  onCancel?: () => void
}

const KNOWN_TYPES = Object.keys(NODE_TYPE_COLORS)

/** id сгенерированного узла — короткий, но достаточно уникальный для
 *  клиентской генерации; финальная уникальность проверяется бэкендом
 *  (add_object отказывает, если id уже существует, см. схему evolve). */
function generateObjectId(cksType: string): string {
  const slug = cksType.toLowerCase().replace(/[^a-z0-9]+/g, '-')
  return `${slug}-${crypto.randomUUID().slice(0, 8)}`
}

export function CreateNodeForm({
  sessionId,
  position,
  onCreated,
  onCancel,
}: CreateNodeFormProps) {
  const [name, setName] = useState('')
  const [cksType, setCksType] = useState(KNOWN_TYPES[0] ?? 'Concept')
  const [customType, setCustomType] = useState('')
  const [structureText, setStructureText] = useState('{}')
  const [structureError, setStructureError] = useState<string | null>(null)

  const { status, errorMessage, diagnostics, warnings, run, reset } =
    useEvolveMutation(sessionId)

  const effectiveType = cksType === '__custom__' ? customType.trim() : cksType
  const isSubmitDisabled =
    status === 'pending' || !name.trim() || !effectiveType

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setStructureError(null)

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

    const id = generateObjectId(effectiveType)
    const identity = { id, type: effectiveType, name: name.trim() }
    const operation = addObjectOperation(identity, structure)

    const optimisticNode: Node = {
      id,
      type: 'cksNode',
      position: position ?? { x: 0, y: 0 },
      data: { label: identity.name, cksType: effectiveType, structure },
    }

    const ok = await run(operation, { node: optimisticNode })
    if (ok) {
      onCreated?.(optimisticNode)
      setName('')
      setStructureText('{}')
      reset()
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="p-4 border-t border-gray-800 bg-gray-900 space-y-3"
    >
      <h3 className="text-sm font-semibold text-gray-200">New object</h3>

      <div>
        <label
          htmlFor="new-node-name"
          className="block text-xs text-gray-500 mb-1"
        >
          Name
        </label>
        <input
          id="new-node-name"
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. Convexity implies continuity"
          className="w-full bg-gray-800 border border-gray-700 rounded px-2 py-1 text-sm text-gray-200"
          required
        />
      </div>

      <div>
        <label
          htmlFor="new-node-type"
          className="block text-xs text-gray-500 mb-1"
        >
          Type
        </label>
        <select
          id="new-node-type"
          value={cksType}
          onChange={(e) => setCksType(e.target.value)}
          className="w-full bg-gray-800 border border-gray-700 rounded px-2 py-1 text-sm text-gray-200"
        >
          {KNOWN_TYPES.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
          <option value="__custom__">Custom…</option>
        </select>
        {cksType === '__custom__' && (
          <input
            type="text"
            value={customType}
            onChange={(e) => setCustomType(e.target.value)}
            placeholder="Custom CKS type"
            className="mt-1 w-full bg-gray-800 border border-gray-700 rounded px-2 py-1 text-sm text-gray-200"
            required
          />
        )}
      </div>

      <div>
        <label
          htmlFor="new-node-structure"
          className="block text-xs text-gray-500 mb-1"
        >
          Structure (JSON, optional)
        </label>
        <textarea
          id="new-node-structure"
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
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            className="rounded bg-gray-700 px-3 py-1.5 text-sm text-gray-300 hover:bg-gray-600"
          >
            Cancel
          </button>
        )}
      </div>
    </form>
  )
}
