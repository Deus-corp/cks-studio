// Copyright (c) 2025 Deus Corp. Licensed under MIT.

import { explainDiff, listVersions } from '@/services/mcpTools'
import { useSessionStore } from '@/services/sessionStore'
import type {
  DiffEntry,
  ExplainDiffResult,
  VersionEntry,
} from '@/shared/types/graph'
import { useEffect, useState } from 'react'
import {
  countDiffChanges,
  formatDiffValue,
  sortVersionsDesc,
} from './versionDiffUtils'

/**
 * Визуальный дифф: текущее состояние сессии vs выбранная прошлая версия.
 *
 * Вся тяжёлая логика (реконструкция версии, structural diff, field-level
 * diff) уже сделана на бэкенде explain_diff (см. cks_mcp/tools/explain_diff/
 * handler.py) — эта фича только рендерит уже готовый ответ. Важно: это
 * всегда "текущее vs версия X", а не диапазон между двумя произвольными
 * версиями (так работает сам инструмент).
 */

function DiffBadge({
  label,
  count,
  tone,
}: {
  label: string
  count: number
  tone: 'add' | 'remove' | 'modify'
}) {
  if (count === 0) return null
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
        <span className="text-xs text-gray-500">({entry.type})</span>
      </div>
      {entry.structure && Object.keys(entry.structure).length > 0 && (
        <div className="mt-1 text-xs text-gray-400 font-mono space-y-0.5">
          {Object.entries(entry.structure).map(([key, value]) => (
            <div key={key}>
              {key}: {formatDiffValue(value)}
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
        <span className="text-xs text-gray-500 no-underline">
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
        <span className="text-xs text-gray-500">({entry.type})</span>
      </div>
      <div className="mt-1.5 space-y-1.5">
        {Object.entries(changes).map(([field, { from, to }]) => (
          <div key={field} className="text-xs">
            <div className="text-gray-500">{field}</div>
            <div className="flex gap-2 mt-0.5">
              <div className="flex-1 rounded px-1.5 py-1 bg-red-900/30 border border-red-800 text-red-300 font-mono break-all">
                {formatDiffValue(from)}
              </div>
              <div className="flex-1 rounded px-1.5 py-1 bg-green-900/30 border border-green-800 text-green-300 font-mono break-all">
                {formatDiffValue(to)}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

function DiffSection({
  title,
  addedEntries,
  removedEntries,
  modifiedEntries,
}: {
  title: string
  addedEntries: DiffEntry[]
  removedEntries: DiffEntry[]
  modifiedEntries: DiffEntry[]
}) {
  if (
    addedEntries.length === 0 &&
    removedEntries.length === 0 &&
    modifiedEntries.length === 0
  ) {
    return null
  }
  return (
    <div className="space-y-2">
      <h3 className="text-xs uppercase tracking-wide text-gray-500 font-semibold">
        {title}
      </h3>
      <div className="space-y-1.5">
        {addedEntries.map((e) => (
          <AddedRow key={e.id} entry={e} />
        ))}
        {removedEntries.map((e) => (
          <RemovedRow key={e.id} entry={e} />
        ))}
        {modifiedEntries.map((e) => (
          <ModifiedRow key={e.id} entry={e} />
        ))}
      </div>
    </div>
  )
}

export function VersionDiff() {
  const { sessionId } = useSessionStore()
  const [versions, setVersions] = useState<VersionEntry[]>([])
  const [targetVersionId, setTargetVersionId] = useState('')
  const [diff, setDiff] = useState<ExplainDiffResult | null>(null)
  const [isLoadingVersions, setIsLoadingVersions] = useState(false)
  const [isLoadingDiff, setIsLoadingDiff] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!sessionId.trim()) return
    setIsLoadingVersions(true)
    setError(null)
    listVersions(sessionId.trim())
      .then((result) => {
        const sorted = sortVersionsDesc(result.versions ?? [])
        setVersions(sorted)
        // По умолчанию сравниваем с предыдущей версией (не с самой
        // первой в истории), если она есть — так первый рендер сразу
        // показывает что-то содержательное.
        if (sorted.length > 1) setTargetVersionId(sorted[1].version_id)
        else if (sorted.length === 1) setTargetVersionId(sorted[0].version_id)
      })
      .catch((e) => {
        setError(e instanceof Error ? e.message : 'Failed to load versions')
      })
      .finally(() => setIsLoadingVersions(false))
  }, [sessionId])

  useEffect(() => {
    if (!sessionId.trim() || !targetVersionId) return
    setIsLoadingDiff(true)
    setError(null)
    setDiff(null)
    explainDiff(sessionId.trim(), targetVersionId)
      .then((result) => {
        // explain_diff возвращает ошибку внутри тела ответа ({error: "..."}),
        // не как JSON-RPC error — callTool такое не бросает как исключение.
        const maybeError = (result as unknown as { error?: string }).error
        if (maybeError) {
          setError(maybeError)
          return
        }
        setDiff(result)
      })
      .catch((e) => {
        setError(e instanceof Error ? e.message : 'Failed to load diff')
      })
      .finally(() => setIsLoadingDiff(false))
  }, [sessionId, targetVersionId])

  if (!sessionId.trim()) {
    return (
      <div className="p-8 text-gray-500 text-sm">
        Подключитесь к сессии на странице Graph, чтобы посмотреть дифф версий.
      </div>
    )
  }

  const counts = diff ? countDiffChanges(diff.details) : null

  return (
    <div className="h-full flex flex-col">
      <header className="bg-gray-900 border-b border-gray-800 px-4 py-3 flex items-center gap-3 flex-wrap">
        <h1 className="text-lg font-semibold">Version Diff</h1>
        <select
          value={targetVersionId}
          onChange={(e) => setTargetVersionId(e.target.value)}
          disabled={isLoadingVersions || versions.length === 0}
          className="bg-gray-800 border border-gray-700 rounded px-2 py-1 text-gray-200 text-sm max-w-xs"
        >
          {versions.length === 0 && <option value="">No versions</option>}
          {versions.map((v, idx) => (
            <option key={v.version_id} value={v.version_id}>
              {idx === 0 ? '(latest) ' : ''}
              {v.version_id.slice(0, 10)}
              {v.version_id.length > 10 ? '…' : ''} —{' '}
              {new Date(v.created_at).toLocaleString()}
            </option>
          ))}
        </select>
        <span className="text-xs text-gray-500">vs current</span>
        {counts && (
          <div className="flex gap-1.5 ml-auto">
            <DiffBadge label="+obj" count={counts.addedObjects} tone="add" />
            <DiffBadge
              label="-obj"
              count={counts.removedObjects}
              tone="remove"
            />
            <DiffBadge
              label="~obj"
              count={counts.modifiedObjects}
              tone="modify"
            />
            <DiffBadge label="+rel" count={counts.addedRelations} tone="add" />
            <DiffBadge
              label="-rel"
              count={counts.removedRelations}
              tone="remove"
            />
            <DiffBadge
              label="~rel"
              count={counts.modifiedRelations}
              tone="modify"
            />
          </div>
        )}
      </header>

      <div className="flex-1 overflow-y-auto p-4">
        {error && (
          <div className="mb-4 text-red-400 text-sm bg-red-900/20 border border-red-800 rounded px-3 py-2">
            {error}
          </div>
        )}

        {isLoadingDiff && (
          <div className="text-gray-500 text-sm">Loading diff…</div>
        )}

        {!isLoadingDiff && diff && (
          <div className="max-w-3xl space-y-5">
            <p className="text-sm text-gray-300">{diff.summary}</p>

            <DiffSection
              title="Objects"
              addedEntries={diff.details.added_objects}
              removedEntries={diff.details.removed_objects}
              modifiedEntries={diff.details.modified_objects}
            />
            <DiffSection
              title="Relations"
              addedEntries={diff.details.added_relations}
              removedEntries={diff.details.removed_relations}
              modifiedEntries={diff.details.modified_relations}
            />

            {diff.details.renamed_objects.length > 0 && (
              <div className="space-y-2">
                <h3 className="text-xs uppercase tracking-wide text-gray-500 font-semibold">
                  Renamed
                </h3>
                <div className="space-y-1.5">
                  {diff.details.renamed_objects.map((r) => (
                    <div
                      key={r.id}
                      className="text-sm text-blue-300 border border-blue-800 bg-blue-900/20 rounded px-3 py-2"
                    >
                      {r.id} → {r.new_name}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {counts?.totalChanges === 0 && (
              <div className="text-gray-500 text-sm">No changes detected.</div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
