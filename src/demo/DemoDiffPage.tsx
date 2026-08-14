// Copyright (c) 2026 Deus Corp. Licensed under MIT.

import { listDemoGraphObjects } from '@/services/mockClient'
import type { DiffEntry } from '@/shared/types/graph'

/** Renders a value the same way the real VersionDiff's formatDiffValue
 *  does -- primitives as-is, everything else JSON.stringify'd. Kept as a
 *  tiny local copy rather than importing from the real feature, since the
 *  task calls for demo-specific pages that don't reach into
 *  features/version-diff. */
function formatValue(value: unknown): string {
  if (value === undefined || value === null) return '—'
  if (typeof value === 'string') return value
  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value)
  }
  try {
    return JSON.stringify(value)
  } catch {
    return String(value)
  }
}

/** Builds a small, plausible three-entry diff (one added, one removed, one
 *  modified) from two objects already present in the bundled ecosystem
 *  graph plus one fictional new object -- deterministic, no MCP calls. */
function buildDemoDiff(): {
  baseVersionId: string
  added: DiffEntry[]
  removed: DiffEntry[]
  modified: DiffEntry[]
} {
  const objects = listDemoGraphObjects()
  const modifiedSource = objects.find((o) => o.identity.id === 'cks-core')
  const removedSource = objects.find((o) => o.identity.id === 'cks-runtime')

  const modified: DiffEntry[] = modifiedSource
    ? [
        {
          id: modifiedSource.identity.id,
          action: 'modified',
          type: modifiedSource.identity.type,
          name: modifiedSource.identity.name,
          changes: {
            version: { from: 'v1.21.1', to: 'v1.22.0' },
            role: {
              from: modifiedSource.structure.role,
              to: modifiedSource.structure.role,
            },
          },
        },
      ]
    : []

  const removed: DiffEntry[] = removedSource
    ? [
        {
          id: removedSource.identity.id,
          action: 'deleted',
          type: removedSource.identity.type,
          name: removedSource.identity.name,
        },
      ]
    : []

  const added: DiffEntry[] = [
    {
      id: 'cks-analytics',
      action: 'added',
      type: 'Component',
      name: 'cks-analytics',
      structure: {
        description: 'Usage analytics and telemetry aggregation service',
        role: 'observability_layer',
        version: 'v0.1.0',
      },
    },
  ]

  return { baseVersionId: 'v2026-01-05T09-00-00Z', added, removed, modified }
}

const DEMO_DIFF = buildDemoDiff()

function DiffBadge({
  label,
  count,
  tone,
}: {
  label: string
  count: number
  tone: 'add' | 'remove' | 'modify'
}) {
  const toneClass =
    tone === 'add'
      ? 'bg-green-900/50 border-green-700 text-green-300'
      : tone === 'remove'
        ? 'bg-red-900/50 border-red-700 text-red-300'
        : 'bg-amber-900/50 border-amber-700 text-amber-300'
  return (
    <span className={`text-xs border rounded px-2 py-0.5 ${toneClass}`}>
      {label}: {count}
    </span>
  )
}

function AddedRow({ entry }: { entry: DiffEntry }) {
  return (
    <div className="border border-green-800 bg-green-900/20 rounded px-3 py-2">
      <div className="text-sm text-green-300">
        + {entry.name}{' '}
        <span className="text-xs text-text-tertiary">({entry.type})</span>
      </div>
      {entry.structure && Object.keys(entry.structure).length > 0 && (
        <div className="mt-1 text-xs text-text-secondary font-mono space-y-0.5">
          {Object.entries(entry.structure).map(([key, value]) => (
            <div key={key}>
              {key}: {formatValue(value)}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function RemovedRow({ entry }: { entry: DiffEntry }) {
  return (
    <div className="border border-red-800 bg-red-900/20 rounded px-3 py-2">
      <div className="text-sm text-red-300 line-through decoration-red-500/60">
        − {entry.name}{' '}
        <span className="text-xs text-text-tertiary no-underline">
          ({entry.type})
        </span>
      </div>
    </div>
  )
}

function ModifiedRow({ entry }: { entry: DiffEntry }) {
  const changes = entry.changes ?? {}
  return (
    <div className="border border-amber-800 bg-amber-900/20 rounded px-3 py-2">
      <div className="text-sm text-amber-300">
        ~ {entry.name}{' '}
        <span className="text-xs text-text-tertiary">({entry.type})</span>
      </div>
      <div className="mt-1.5 space-y-1.5">
        {Object.entries(changes).map(([field, { from, to }]) => (
          <div key={field} className="text-xs">
            <div className="text-text-tertiary">{field}</div>
            <div className="flex gap-2 mt-0.5">
              <div className="flex-1 rounded px-1.5 py-1 bg-red-900/30 border border-red-800 text-red-300 font-mono break-all">
                {formatValue(from)}
              </div>
              <div className="flex-1 rounded px-1.5 py-1 bg-green-900/30 border border-green-800 text-green-300 font-mono break-all">
                {formatValue(to)}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

/**
 * Static stand-in for VersionDiff (which normally calls explain_diff
 * against a live cks-mcp session). Shows one added, one removed and one
 * modified object built from a couple of real bundled-graph objects plus
 * one fictional addition -- hardcoded/deterministic, no MCP calls.
 */
export function DemoDiffPage() {
  const { baseVersionId, added, removed, modified } = DEMO_DIFF

  return (
    <div className="h-full flex flex-col">
      <div className="flex items-center gap-3 px-4 py-3 border-b border-border-subtle flex-wrap">
        <h2 className="text-sm font-semibold text-text-primary">
          Version Diff
        </h2>
        <span className="text-xs text-text-tertiary">
          current vs {baseVersionId}
        </span>
        <div className="ml-auto flex items-center gap-2">
          <DiffBadge label="Added" count={added.length} tone="add" />
          <DiffBadge label="Removed" count={removed.length} tone="remove" />
          <DiffBadge label="Modified" count={modified.length} tone="modify" />
        </div>
      </div>

      <p className="text-xs text-text-tertiary px-4 pt-3">
        Demo diff — connect a live server to compare real versions.
      </p>

      <div className="flex-1 overflow-y-auto p-4 space-y-2">
        {added.map((e) => (
          <AddedRow key={e.id} entry={e} />
        ))}
        {removed.map((e) => (
          <RemovedRow key={e.id} entry={e} />
        ))}
        {modified.map((e) => (
          <ModifiedRow key={e.id} entry={e} />
        ))}
      </div>
    </div>
  )
}
