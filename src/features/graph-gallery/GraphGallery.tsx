// Copyright (c) 2025 Deus Corp. Licensed under MIT.

import { memo, useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { HealthIndicator } from '@/components/common/HealthIndicator'
import { IconButton } from '@/components/common/IconButton'
import { CompareGraphsModal } from '@/features/cross-graph/CompareGraphsModal'
import {
  cloneGraph,
  unregisterGraph,
  updateGraphLifecycle,
} from '@/services/mcpTools'
import { useSessionStore } from '@/services/sessionStore'
import type { GraphRegistryEntry, LifecycleState } from '@/shared/types/graph'
import { formatDateTime } from '@/shared/utils/formatUtils'
import { GraphPreview } from './GraphPreview'
import { useGalleryStore } from './galleryStore'
import {
  collectTags,
  formatTags,
  SORT_OPTIONS,
  sortGraphs,
} from './galleryUtils'

// Color coding for each lifecycle state, mirrored from the spec:
// draft: gray, published: blue, active: green, stale: amber,
// under_review: purple, archived: red/gray.
const LIFECYCLE_COLORS: Record<LifecycleState, string> = {
  draft: 'text-text-secondary bg-surface-2',
  published: 'text-blue-600 dark:text-blue-400 bg-blue-500/10',
  active: 'text-success bg-success/10',
  stale: 'text-amber-600 dark:text-amber-400 bg-amber-500/10',
  under_review: 'text-purple-600 dark:text-purple-400 bg-purple-500/10',
  archived: 'text-danger bg-danger/10',
}

const LIFECYCLE_LABELS: Record<LifecycleState, string> = {
  draft: 'Draft',
  published: 'Published',
  active: 'Active',
  stale: 'Stale',
  under_review: 'Under review',
  archived: 'Archived',
}

// Mirrors cks_mcp/tools/update_graph_lifecycle/handler.py's
// ALLOWED_TRANSITIONS -- kept in sync manually since this is a UI
// convenience (which options to offer) rather than the source of
// truth; the server re-validates every request regardless.
const ALLOWED_LIFECYCLE_TRANSITIONS: Record<LifecycleState, LifecycleState[]> =
  {
    draft: ['published', 'archived'],
    published: ['active', 'under_review', 'archived'],
    active: ['stale', 'under_review', 'archived'],
    stale: ['under_review', 'active', 'archived'],
    under_review: ['active', 'published', 'archived'],
    archived: [],
  }

/** Same default the server applies when lifecycle_state is absent
 *  (older graph, or a server predating this field). */
function resolveLifecycleState(graph: GraphRegistryEntry): LifecycleState {
  if (graph.lifecycle_state) return graph.lifecycle_state
  return graph.public ? 'published' : 'draft'
}

function LifecycleBadge({
  graph,
  onChanged,
}: {
  graph: GraphRegistryEntry
  onChanged: () => void
}) {
  const currentState = resolveLifecycleState(graph)
  const [isOpen, setIsOpen] = useState(false)
  const [isUpdating, setIsUpdating] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const options = ALLOWED_LIFECYCLE_TRANSITIONS[currentState]

  const handleTransition = async (state: LifecycleState) => {
    setIsOpen(false)
    setIsUpdating(true)
    setError(null)
    try {
      const result = await updateGraphLifecycle({ name: graph.name, state })
      if ('error' in result) {
        setError(result.message)
      } else {
        onChanged()
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unknown error')
    } finally {
      setIsUpdating(false)
    }
  }

  return (
    <div className="relative inline-flex flex-col items-start gap-0.5">
      <button
        type="button"
        onClick={() => options.length > 0 && setIsOpen((v) => !v)}
        disabled={isUpdating || options.length === 0}
        title={
          options.length > 0
            ? 'Change lifecycle state'
            : 'This is a terminal lifecycle state'
        }
        className={`text-[10px] uppercase tracking-wide px-1.5 py-0.5 rounded ${LIFECYCLE_COLORS[currentState]} ${
          options.length > 0
            ? 'cursor-pointer hover:opacity-80'
            : 'cursor-default'
        }`}
      >
        {isUpdating ? 'Updating…' : LIFECYCLE_LABELS[currentState]}
      </button>

      {isOpen && options.length > 0 && (
        <div className="absolute top-full left-0 mt-1 z-10 bg-surface-1 border border-border-subtle rounded shadow-lg py-1 min-w-[9rem]">
          {options.map((state) => (
            <button
              key={state}
              type="button"
              onClick={() => handleTransition(state)}
              className="w-full text-left text-xs px-2 py-1 hover:bg-surface-2 text-text-primary"
            >
              {LIFECYCLE_LABELS[state]}
            </button>
          ))}
        </div>
      )}

      {error && <p className="text-[10px] text-danger">{error}</p>}
    </div>
  )
}

function HealthBadge({ name }: { name: string }) {
  const { health, healthLoading, loadHealth } = useGalleryStore()
  return (
    <HealthIndicator
      result={health[name]}
      loading={Boolean(healthLoading[name])}
      onCheck={() => loadHealth(name)}
    />
  )
}

function GraphCard({
  graph,
  compareMode,
  isSelected,
  onToggleSelect,
}: {
  graph: GraphRegistryEntry
  compareMode: boolean
  isSelected: boolean
  /** Takes the graph name rather than being pre-bound per-card, so the
   *  gallery can pass one stable (useCallback'd) function to every card
   *  instead of a fresh closure per card per render -- see the memo()
   *  wrap below, which this makes actually effective. */
  onToggleSelect: (name: string) => void
}) {
  const navigate = useNavigate()
  const { setSessionId } = useSessionStore()
  const { setQuery, setTag, load } = useGalleryStore()
  const [isCloning, setIsCloning] = useState(false)
  const [cloneError, setCloneError] = useState<string | null>(null)
  const [cloneMessage, setCloneMessage] = useState<string | null>(null)
  const [showPreview, setShowPreview] = useState(false)
  const [confirmingDelete, setConfirmingDelete] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState<string | null>(null)

  const handleOpen = () => {
    setSessionId(graph.session_id)
    // Автоматически запускаем подключение после перехода
    setTimeout(() => navigate('/'), 0)
  }

  const handleClone = async () => {
    setIsCloning(true)
    setCloneError(null)
    setCloneMessage(null)
    try {
      const result = await cloneGraph({ graphName: graph.name })
      setSessionId(result.session_id)
      setCloneMessage(`Cloned into session ${result.session_id}`)
      setTimeout(() => navigate('/'), 0)
    } catch (e) {
      setCloneError(e instanceof Error ? e.message : 'Unknown error')
    } finally {
      setIsCloning(false)
    }
  }

  // Прыжок к графу-первоисточнику: сбрасываем тег-фильтр (он мог
  // относиться к текущей карточке, а не к оригиналу) и ищем оригинал по
  // точному имени, чтобы он остался единственной карточкой в списке.
  const handleJumpToSource = () => {
    if (!graph.source_graph_name) return
    setTag('')
    setQuery(graph.source_graph_name)
    load()
  }

  const handleDelete = async () => {
    setIsDeleting(true)
    setDeleteError(null)
    try {
      const result = await unregisterGraph({ name: graph.name })
      if ('error' in result) {
        setDeleteError(result.message)
        setConfirmingDelete(false)
        return
      }
      // Успех: карточка исчезает вместе с перезагрузкой списка,
      // так что отдельное сообщение об успехе тут не нужно.
      await load()
    } catch (e) {
      setDeleteError(e instanceof Error ? e.message : 'Unknown error')
      setConfirmingDelete(false)
    } finally {
      setIsDeleting(false)
    }
  }

  return (
    <div
      className={`bg-surface-1 border rounded p-3 flex flex-col gap-2 ${
        compareMode && isSelected
          ? 'border-accent ring-1 ring-accent'
          : 'border-border-subtle'
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-start gap-2">
          {compareMode && (
            <input
              type="checkbox"
              checked={isSelected}
              onChange={() => onToggleSelect(graph.name)}
              aria-label={`Select ${graph.name} for comparison`}
              className="mt-1"
            />
          )}
          <div>
            <h3 className="text-sm font-semibold text-text-primary">
              {graph.name}
            </h3>
            <p className="text-xs text-text-tertiary">{graph.session_id}</p>
          </div>
        </div>
        <div className="flex flex-col items-end gap-1">
          <LifecycleBadge graph={graph} onChanged={load} />
          <div className="flex items-center gap-1">
            {graph.public && (
              <span className="text-[10px] uppercase tracking-wide text-accent bg-accent-muted px-1.5 py-0.5 rounded">
                Public
              </span>
            )}
            {!graph.public && graph.visibility === 'team' && (
              <span
                className="text-[10px] uppercase tracking-wide text-text-secondary bg-surface-2 px-1.5 py-0.5 rounded"
                title={graph.team ? `Team: ${graph.team}` : undefined}
              >
                Team{graph.team ? `: ${graph.team}` : ''}
              </span>
            )}
          </div>
        </div>
      </div>

      <IconButton
        onClick={() => setShowPreview((v) => !v)}
        active={showPreview}
        label={showPreview ? 'Hide preview' : 'Show preview'}
        size="sm"
        className="self-start !shadow-none"
        icon={
          <svg
            width="13"
            height="13"
            viewBox="0 0 24 24"
            fill="none"
            aria-hidden="true"
          >
            <path
              d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7z"
              stroke="currentColor"
              strokeWidth="1.6"
            />
            <circle
              cx="12"
              cy="12"
              r="3"
              stroke="currentColor"
              strokeWidth="1.6"
            />
          </svg>
        }
      />
      {showPreview && (
        <GraphPreview sessionId={graph.session_id} onOpen={handleOpen} />
      )}

      {graph.source_graph_name && (
        <button
          type="button"
          onClick={handleJumpToSource}
          title={`Jump to the original graph "${graph.source_graph_name}"`}
          className="self-start text-[10px] text-text-tertiary hover:text-accent hover:underline"
        >
          🍴 Forked from {graph.source_graph_name}
        </button>
      )}

      {graph.description && (
        <p className="text-xs text-text-secondary line-clamp-3">
          {graph.description}
        </p>
      )}

      {formatTags(graph.tags).length > 0 && (
        <div className="flex flex-wrap gap-1">
          {formatTags(graph.tags).map((tag) => (
            <span
              key={tag}
              className="text-[10px] text-text-secondary bg-surface-2 px-1.5 py-0.5 rounded"
            >
              {tag}
            </span>
          ))}
        </div>
      )}

      <p className="text-[10px] text-text-tertiary">
        Updated {formatDateTime(graph.updated_at)}
      </p>

      {/* mt-auto pins this row to the bottom of the flex-column card
       *  regardless of how much content (description, tags, fork
       *  link, etc.) rendered above it -- without this the row's
       *  vertical position shifted per-card based on whether
       *  description/tags were present. */}
      <div className="flex items-center justify-between mt-auto gap-2">
        <HealthBadge name={graph.name} />
        <div className="flex items-center gap-1.5">
          <IconButton
            onClick={handleClone}
            disabled={isCloning}
            label="Clone"
            title="Copy this graph into a new session of your own"
            className="!bg-surface-2 hover:!bg-surface-3"
            icon={
              isCloning ? (
                <div className="h-3 w-3 animate-spin rounded-full border-2 border-current border-t-transparent" />
              ) : (
                <svg
                  width="13"
                  height="13"
                  viewBox="0 0 24 24"
                  fill="none"
                  aria-hidden="true"
                >
                  <rect
                    x="9"
                    y="9"
                    width="12"
                    height="12"
                    rx="1.5"
                    stroke="currentColor"
                    strokeWidth="1.6"
                  />
                  <path
                    d="M6 15H4.5A1.5 1.5 0 013 13.5v-9A1.5 1.5 0 014.5 3h9A1.5 1.5 0 0115 4.5V6"
                    stroke="currentColor"
                    strokeWidth="1.6"
                  />
                </svg>
              )
            }
          />
          <button
            type="button"
            onClick={handleOpen}
            className="text-xs bg-accent hover:bg-accent-strong text-white px-2 py-1 rounded"
          >
            Open in Graph
          </button>
          <IconButton
            onClick={() => setConfirmingDelete(true)}
            disabled={isDeleting}
            label="Delete from gallery"
            title="Remove this graph from the Gallery (the session itself is kept)"
            className="!bg-surface-2 hover:!bg-danger/10 hover:!text-danger"
            icon={
              isDeleting ? (
                <div className="h-3 w-3 animate-spin rounded-full border-2 border-current border-t-transparent" />
              ) : (
                <svg
                  width="13"
                  height="13"
                  viewBox="0 0 24 24"
                  fill="none"
                  aria-hidden="true"
                >
                  <path
                    d="M4 7h16M9 7V4.5A1.5 1.5 0 0110.5 3h3A1.5 1.5 0 0115 4.5V7m2 0v12.5A1.5 1.5 0 0115.5 21h-7A1.5 1.5 0 017 19.5V7h10z"
                    stroke="currentColor"
                    strokeWidth="1.6"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                  <path
                    d="M10 11v6M14 11v6"
                    stroke="currentColor"
                    strokeWidth="1.6"
                    strokeLinecap="round"
                  />
                </svg>
              )
            }
          />
        </div>
      </div>

      {confirmingDelete && (
        <div className="flex items-center justify-between gap-2 bg-danger/10 border border-danger/30 rounded px-2 py-1.5">
          <p className="text-[10px] text-danger">
            Remove "{graph.name}" from the Gallery? The session itself won't be
            deleted.
          </p>
          <div className="flex items-center gap-1 shrink-0">
            <button
              type="button"
              onClick={handleDelete}
              disabled={isDeleting}
              className="text-[10px] bg-danger hover:bg-danger/90 text-white px-2 py-1 rounded disabled:opacity-50"
            >
              {isDeleting ? 'Removing…' : 'Remove'}
            </button>
            <button
              type="button"
              onClick={() => setConfirmingDelete(false)}
              disabled={isDeleting}
              className="text-[10px] bg-surface-2 hover:bg-surface-3 text-text-primary px-2 py-1 rounded disabled:opacity-50"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {cloneMessage && (
        <p className="text-[10px] text-success">{cloneMessage}</p>
      )}
      {cloneError && <p className="text-[10px] text-danger">{cloneError}</p>}
      {deleteError && <p className="text-[10px] text-danger">{deleteError}</p>}
    </div>
  )
}

// Re-renders only when this card's own props actually change -- without
// this, every keystroke in the gallery's search/tag inputs (GraphGallery
// re-rendering) re-rendered every visible GraphCard too, even though
// only `graphs`/`sortedGraphs` changing (a real data update) should
// affect card contents. `graph` itself is a fresh object per store
// update even when unrelated fields changed elsewhere in the gallery
// state, so this is a plain re-render-avoidance memo, not a deep-equal
// one -- it still re-renders whenever this card's own `graph` reference
// changes (i.e. whenever this graph's data actually changed).
const MemoizedGraphCard = memo(GraphCard)

/**
 * Graph Gallery (Memory Agent v1/v2): просмотр графов, зарегистрированных
 * через register_graph. По умолчанию показывает только public=true графы
 * (list_graphs(public_only=true)) — приватные видны только по точному имени
 * через get_graph, здесь их сознательно не показываем.
 */
export function GraphGallery() {
  const {
    graphs,
    query,
    tag,
    publicOnly,
    team,
    sortBy,
    isLoading,
    error,
    setQuery,
    setTag,
    setPublicOnly,
    setTeam,
    setSortBy,
    load,
  } = useGalleryStore()

  const [compareMode, setCompareMode] = useState(false)
  const [selectedForCompare, setSelectedForCompare] = useState<string[]>([])
  const [showCompareModal, setShowCompareModal] = useState(false)

  const handleToggleCompareMode = () => {
    setCompareMode((v) => !v)
    setSelectedForCompare([])
  }

  const handleToggleSelect = useCallback((name: string) => {
    setSelectedForCompare((prev) => {
      if (prev.includes(name)) return prev.filter((n) => n !== name)
      // Cap at 2: compare_graphs takes exactly two sides -- selecting a
      // third drops the oldest selection rather than silently ignoring
      // the click, so the two checkboxes shown checked always match
      // what Compare will actually run against.
      const next = [...prev, name]
      return next.length > 2 ? next.slice(next.length - 2) : next
    })
  }, [])

  // biome-ignore lint/correctness/useExhaustiveDependencies: load читает query/tag/publicOnly из своего замыкания на момент вызова
  useEffect(() => {
    load()
  }, [])

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    load()
  }

  // Union тегов из текущего (уже отфильтрованного бэкендом) списка — чипы
  // быстрого фильтра, а не полный справочник тегов по всей галерее.
  const availableTags = useMemo(() => collectTags(graphs), [graphs])
  const sortedGraphs = useMemo(
    () => sortGraphs(graphs, sortBy),
    [graphs, sortBy],
  )

  const handleTagChipClick = (clicked: string) => {
    setTag(tag === clicked ? '' : clicked)
    load()
  }

  return (
    <div className="h-full flex flex-col">
      <form
        onSubmit={handleSearchSubmit}
        className="flex items-center gap-2 px-4 py-3 border-b border-border-subtle flex-wrap"
      >
        <h2 className="text-sm font-semibold text-text-primary mr-2">
          Graph Gallery
        </h2>
        <input
          type="text"
          placeholder="Search by name / description / tags…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="bg-surface-2 border border-border rounded px-2 py-1 w-64 text-xs text-text-primary placeholder:text-text-tertiary"
        />
        <input
          type="text"
          placeholder="tag filter"
          value={tag}
          onChange={(e) => setTag(e.target.value)}
          className="bg-surface-2 border border-border rounded px-2 py-1 w-32 text-xs text-text-primary placeholder:text-text-tertiary"
        />
        <label className="flex items-center gap-1 text-xs text-text-secondary">
          <input
            type="checkbox"
            checked={publicOnly}
            onChange={(e) => setPublicOnly(e.target.checked)}
          />
          Public only
        </label>
        {!publicOnly && (
          <input
            type="text"
            placeholder="team namespace"
            value={team}
            onChange={(e) => setTeam(e.target.value)}
            title="Also show visibility='team' graphs scoped to this team, alongside public graphs"
            className="bg-surface-2 border border-border rounded px-2 py-1 w-32 text-xs text-text-primary placeholder:text-text-tertiary"
          />
        )}
        <select
          value={sortBy}
          onChange={(e) => setSortBy(e.target.value as typeof sortBy)}
          aria-label="Sort by"
          className="bg-surface-2 border border-border rounded px-2 py-1 text-xs text-text-primary"
        >
          {SORT_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
        <button
          type="submit"
          disabled={isLoading}
          className="text-xs bg-surface-2 hover:bg-surface-3 text-text-primary px-2 py-1 rounded disabled:opacity-50"
        >
          {isLoading ? 'Loading…' : 'Search'}
        </button>
        <button
          type="button"
          onClick={handleToggleCompareMode}
          aria-pressed={compareMode}
          className={`text-xs px-2 py-1 rounded ${
            compareMode
              ? 'bg-accent text-white'
              : 'bg-surface-2 hover:bg-surface-3 text-text-primary'
          }`}
        >
          {compareMode ? 'Exit compare' : 'Compare graphs'}
        </button>
      </form>

      {availableTags.length > 0 && (
        <div className="flex items-center gap-1.5 flex-wrap px-4 py-2 border-b border-border-subtle">
          <span className="text-[10px] text-text-tertiary uppercase tracking-wide mr-1">
            Tags
          </span>
          {availableTags.map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => handleTagChipClick(t)}
              className={`text-[10px] px-1.5 py-0.5 rounded ${
                tag === t
                  ? 'bg-accent text-white'
                  : 'bg-surface-2 hover:bg-surface-3 text-text-secondary'
              }`}
            >
              {t}
            </button>
          ))}
        </div>
      )}

      {error && <p className="text-danger text-xs px-4 py-2">{error}</p>}

      {!error && !isLoading && graphs.length === 0 && (
        <p className="text-xs text-text-tertiary px-4 py-3">
          No graphs found. Graphs appear here when registered via register_graph
          with public=true. If you expected to see a graph here, verify it was
          registered as public.
        </p>
      )}

      <div className="flex-1 overflow-y-auto p-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 content-start">
        {sortedGraphs.map((graph) => (
          <MemoizedGraphCard
            key={graph.name}
            graph={graph}
            compareMode={compareMode}
            isSelected={selectedForCompare.includes(graph.name)}
            onToggleSelect={handleToggleSelect}
          />
        ))}
      </div>

      {compareMode && selectedForCompare.length === 2 && (
        <div className="flex items-center justify-center gap-2 px-4 py-2 border-t border-border-subtle bg-surface-1">
          <p className="text-xs text-text-secondary">
            {selectedForCompare[0]} vs {selectedForCompare[1]}
          </p>
          <button
            type="button"
            onClick={() => setShowCompareModal(true)}
            className="text-xs bg-accent hover:bg-accent-strong text-white px-3 py-1.5 rounded"
          >
            Compare selected
          </button>
        </div>
      )}

      {showCompareModal && selectedForCompare.length === 2 && (
        <CompareGraphsModal
          graphAName={selectedForCompare[0]}
          graphBName={selectedForCompare[1]}
          onClose={() => setShowCompareModal(false)}
        />
      )}
    </div>
  )
}
