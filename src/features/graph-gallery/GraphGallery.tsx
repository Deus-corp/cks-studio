// Copyright (c) 2025 Deus Corp. Licensed under MIT.

import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { HealthIndicator } from '@/components/common/HealthIndicator'
import { cloneGraph } from '@/services/mcpTools'
import { useSessionStore } from '@/services/sessionStore'
import type { GraphRegistryEntry } from '@/shared/types/graph'
import { formatDateTime } from '@/shared/utils/formatUtils'
import { useGalleryStore } from './galleryStore'
import {
  collectTags,
  formatTags,
  SORT_OPTIONS,
  sortGraphs,
} from './galleryUtils'

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

function GraphCard({ graph }: { graph: GraphRegistryEntry }) {
  const navigate = useNavigate()
  const { setSessionId } = useSessionStore()
  const { setQuery, setTag, load } = useGalleryStore()
  const [isCloning, setIsCloning] = useState(false)
  const [cloneError, setCloneError] = useState<string | null>(null)
  const [cloneMessage, setCloneMessage] = useState<string | null>(null)

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

  return (
    <div className="bg-surface-1 border border-border-subtle rounded p-3 flex flex-col gap-2">
      <div className="flex items-start justify-between gap-2">
        <div>
          <h3 className="text-sm font-semibold text-text-primary">
            {graph.name}
          </h3>
          <p className="text-xs text-text-tertiary">{graph.session_id}</p>
        </div>
        {graph.public && (
          <span className="text-[10px] uppercase tracking-wide text-accent bg-accent-muted px-1.5 py-0.5 rounded">
            Public
          </span>
        )}
      </div>

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

      <div className="flex items-center justify-between mt-1 gap-2">
        <HealthBadge name={graph.name} />
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={handleClone}
            disabled={isCloning}
            title="Copy this graph into a new session of your own"
            className="text-xs bg-surface-2 hover:bg-surface-3 text-text-primary px-2 py-1 rounded disabled:opacity-50"
          >
            {isCloning ? 'Cloning…' : 'Clone'}
          </button>
          <button
            type="button"
            onClick={handleOpen}
            className="text-xs bg-accent hover:bg-accent-strong text-white px-2 py-1 rounded"
          >
            Open in Graph
          </button>
        </div>
      </div>

      {cloneMessage && (
        <p className="text-[10px] text-success">{cloneMessage}</p>
      )}
      {cloneError && <p className="text-[10px] text-danger">{cloneError}</p>}
    </div>
  )
}

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
    sortBy,
    isLoading,
    error,
    setQuery,
    setTag,
    setPublicOnly,
    setSortBy,
    load,
  } = useGalleryStore()

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
          <GraphCard key={graph.name} graph={graph} />
        ))}
      </div>
    </div>
  )
}
