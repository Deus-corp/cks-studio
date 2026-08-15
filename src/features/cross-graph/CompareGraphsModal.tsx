// Copyright (c) 2026 Deus Corp. Licensed under MIT.

import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { compareGraphs, mergeGraphs } from '@/services/mcpTools'
import { useSessionStore } from '@/services/sessionStore'
import type {
  CompareGraphsResult,
  MergeGraphsResult,
} from '@/shared/types/graph'

interface CompareGraphsModalProps {
  graphAName: string
  graphBName: string
  onClose: () => void
}

/** Renders one field-level change from compare_graphs.differences (see
 *  cks_mcp/diffing.py::field_level_diff -- {field: {from, to}}). */
function DiffRow({
  objectId,
  field,
  from,
  to,
}: {
  objectId: string
  field: string
  from: unknown
  to: unknown
}) {
  const fmt = (v: unknown) =>
    v === null || v === undefined
      ? '—'
      : typeof v === 'string'
        ? v
        : JSON.stringify(v)
  return (
    <div className="text-xs bg-surface-2 rounded px-2 py-1.5">
      <div className="text-text-tertiary">
        <span className="text-text-primary">{objectId}</span> · {field}
      </div>
      <div className="flex gap-2 mt-1">
        <div className="flex-1 rounded bg-danger/10 border border-danger/30 px-1.5 py-0.5 text-danger truncate">
          {fmt(from)}
        </div>
        <div className="flex-1 rounded bg-success/10 border border-success/30 px-1.5 py-0.5 text-success truncate">
          {fmt(to)}
        </div>
      </div>
    </div>
  )
}

function IdList({ ids, emptyLabel }: { ids: string[]; emptyLabel: string }) {
  if (ids.length === 0) {
    return <p className="text-xs text-text-tertiary italic">{emptyLabel}</p>
  }
  return (
    <ul className="space-y-0.5 max-h-32 overflow-y-auto">
      {ids.map((id) => (
        <li
          key={id}
          className="text-xs text-text-secondary bg-surface-2 rounded px-1.5 py-0.5 truncate"
        >
          {id}
        </li>
      ))}
    </ul>
  )
}

/**
 * Compare (and optionally merge) two graphs selected from the Gallery.
 * compare_graphs runs eagerly on mount; merge_graphs only runs when the
 * user clicks Merge, since it's a mutating call that creates a new
 * session (see mcpTools.mergeGraphs).
 */
export function CompareGraphsModal({
  graphAName,
  graphBName,
  onClose,
}: CompareGraphsModalProps) {
  const navigate = useNavigate()
  const { setSessionId } = useSessionStore()

  const [compareResult, setCompareResult] =
    useState<CompareGraphsResult | null>(null)
  const [compareError, setCompareError] = useState<string | null>(null)
  const [isComparing, setIsComparing] = useState(true)

  const [mergeResult, setMergeResult] = useState<MergeGraphsResult | null>(null)
  const [mergeError, setMergeError] = useState<string | null>(null)
  const [isMerging, setIsMerging] = useState(false)
  const [registerAs, setRegisterAs] = useState('')

  useEffect(() => {
    let cancelled = false
    setIsComparing(true)
    setCompareError(null)
    ;(async () => {
      try {
        const result = await compareGraphs({
          graphA: { graphName: graphAName },
          graphB: { graphName: graphBName },
        })
        if (!cancelled) setCompareResult(result)
      } catch (e) {
        if (!cancelled) {
          setCompareError(e instanceof Error ? e.message : 'Unknown error')
        }
      } finally {
        if (!cancelled) setIsComparing(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [graphAName, graphBName])

  const handleMerge = async (resolutions?: Record<string, unknown>) => {
    setIsMerging(true)
    setMergeError(null)
    try {
      const result = await mergeGraphs({
        graphA: { graphName: graphAName },
        graphB: { graphName: graphBName },
        resolutions,
        registerAs: registerAs.trim() || undefined,
      })
      setMergeResult(result)
    } catch (e) {
      setMergeError(e instanceof Error ? e.message : 'Unknown error')
    } finally {
      setIsMerging(false)
    }
  }

  // "Keep A" / "Keep B" for every conflicting object -- the quickest path
  // through a conflict when the user just wants *a* result rather than
  // reviewing each object individually; per-object resolution stays
  // available by editing resolutions manually isn't exposed here, this
  // covers the common case.
  const handleResolveAll = (side: 'branch_a' | 'branch_b') => {
    if (!mergeResult?.conflicts) return
    const resolutions: Record<string, unknown> = {}
    for (const c of mergeResult.conflicts) {
      resolutions[c.object_id] = side
    }
    handleMerge(resolutions)
  }

  const handleOpenMerged = () => {
    if (!mergeResult?.session_id) return
    setSessionId(mergeResult.session_id)
    onClose()
    setTimeout(() => navigate('/'), 0)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-surface-1 border border-border-subtle rounded-lg w-full max-w-2xl max-h-[85vh] flex flex-col">
        <div className="flex items-center justify-between px-4 py-3 border-b border-border-subtle">
          <h2 className="text-sm font-semibold text-text-primary">
            Compare: {graphAName} vs {graphBName}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="text-text-tertiary hover:text-text-primary text-lg leading-none"
          >
            ×
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {isComparing && (
            <p className="text-xs text-text-tertiary">Comparing…</p>
          )}
          {compareError && (
            <p className="text-xs text-danger">{compareError}</p>
          )}

          {compareResult && (
            <>
              <div className="grid grid-cols-3 gap-2 text-center">
                <div className="bg-surface-2 rounded p-2">
                  <div className="text-lg font-semibold text-text-primary">
                    {compareResult.shared_object_count}
                  </div>
                  <div className="text-[10px] text-text-tertiary uppercase tracking-wide">
                    Shared
                  </div>
                </div>
                <div className="bg-surface-2 rounded p-2">
                  <div className="text-lg font-semibold text-text-primary">
                    {compareResult.only_in_a_count}
                  </div>
                  <div className="text-[10px] text-text-tertiary uppercase tracking-wide">
                    Only in {graphAName}
                  </div>
                </div>
                <div className="bg-surface-2 rounded p-2">
                  <div className="text-lg font-semibold text-text-primary">
                    {compareResult.only_in_b_count}
                  </div>
                  <div className="text-[10px] text-text-tertiary uppercase tracking-wide">
                    Only in {graphBName}
                  </div>
                </div>
              </div>

              {compareResult.differences.length > 0 && (
                <div>
                  <h3 className="text-xs font-semibold text-text-secondary uppercase tracking-wide mb-1.5">
                    Differences ({compareResult.differences.length})
                  </h3>
                  <div className="space-y-1.5 max-h-48 overflow-y-auto">
                    {compareResult.differences.flatMap((d) =>
                      Object.entries(d.changes ?? {}).map(([field, ch]) => (
                        <DiffRow
                          key={`${d.id}-${field}`}
                          objectId={d.id}
                          field={field}
                          from={ch.from}
                          to={ch.to}
                        />
                      )),
                    )}
                  </div>
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <h3 className="text-xs font-semibold text-text-secondary uppercase tracking-wide mb-1.5">
                    Only in {graphAName}
                  </h3>
                  <IdList
                    ids={compareResult.only_in_a}
                    emptyLabel="Nothing unique here"
                  />
                </div>
                <div>
                  <h3 className="text-xs font-semibold text-text-secondary uppercase tracking-wide mb-1.5">
                    Only in {graphBName}
                  </h3>
                  <IdList
                    ids={compareResult.only_in_b}
                    emptyLabel="Nothing unique here"
                  />
                </div>
              </div>

              {!mergeResult && (
                <div className="border-t border-border-subtle pt-3 space-y-2">
                  <label
                    htmlFor="merge-register-as"
                    className="block text-xs text-text-tertiary"
                  >
                    Register merged graph as (optional)
                  </label>
                  <input
                    id="merge-register-as"
                    type="text"
                    value={registerAs}
                    onChange={(e) => setRegisterAs(e.target.value)}
                    placeholder="e.g. merged-graph"
                    className="w-full bg-surface-2 border border-border rounded px-2 py-1 text-xs text-text-primary placeholder:text-text-tertiary"
                  />
                  <button
                    type="button"
                    onClick={() => handleMerge()}
                    disabled={isMerging}
                    className="text-xs bg-accent hover:bg-accent-strong text-white px-3 py-1.5 rounded disabled:opacity-50"
                  >
                    {isMerging ? 'Merging…' : 'Merge into new session'}
                  </button>
                  {mergeError && (
                    <p className="text-xs text-danger">{mergeError}</p>
                  )}
                </div>
              )}

              {mergeResult?.merged === true && (
                <div className="border-t border-border-subtle pt-3 space-y-2">
                  <p className="text-xs text-success">
                    Merged into session {mergeResult.session_id} (
                    {mergeResult.object_count} objects)
                    {mergeResult.registered_as
                      ? ` — registered as "${mergeResult.registered_as}"`
                      : ''}
                    .
                  </p>
                  {mergeResult.dropped_relations &&
                    mergeResult.dropped_relations.length > 0 && (
                      <p className="text-[10px] text-text-tertiary">
                        {mergeResult.dropped_relations.length} relation(s)
                        dropped (participant removed during merge).
                      </p>
                    )}
                  <button
                    type="button"
                    onClick={handleOpenMerged}
                    className="text-xs bg-accent hover:bg-accent-strong text-white px-3 py-1.5 rounded"
                  >
                    Open merged graph
                  </button>
                </div>
              )}

              {mergeResult?.merged === false && (
                <div className="border-t border-border-subtle pt-3 space-y-2">
                  <p className="text-xs text-danger">
                    {mergeResult.message ??
                      'Merge conflict — resolve below and retry.'}
                  </p>
                  <ul className="space-y-1 max-h-40 overflow-y-auto">
                    {(mergeResult.conflicts ?? []).map((c) => (
                      <li
                        key={c.object_id}
                        className="text-xs bg-danger/10 border border-danger/30 rounded px-2 py-1"
                      >
                        <span className="text-text-primary">{c.object_id}</span>
                      </li>
                    ))}
                  </ul>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => handleResolveAll('branch_a')}
                      disabled={isMerging}
                      className="text-xs bg-surface-2 hover:bg-surface-3 text-text-primary px-2 py-1 rounded disabled:opacity-50"
                    >
                      Keep all from {graphAName}
                    </button>
                    <button
                      type="button"
                      onClick={() => handleResolveAll('branch_b')}
                      disabled={isMerging}
                      className="text-xs bg-surface-2 hover:bg-surface-3 text-text-primary px-2 py-1 rounded disabled:opacity-50"
                    >
                      Keep all from {graphBName}
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}
