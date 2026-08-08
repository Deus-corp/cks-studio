// Copyright (c) 2025 Deus Corp. Licensed under MIT.

import { useSessionStore } from '@/services/sessionStore'
import type { GraphRegistryEntry } from '@/shared/types/graph'
import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useGalleryStore } from './galleryStore'
import { formatTags, healthColor } from './galleryUtils'

function HealthBadge({ name }: { name: string }) {
  const { health, healthLoading, loadHealth } = useGalleryStore()
  const result = health[name]
  const loading = healthLoading[name]

  if (!result && !loading) {
    return (
      <button
        type="button"
        onClick={() => loadHealth(name)}
        className="text-xs text-gray-500 hover:text-gray-300 underline"
      >
        Check health
      </button>
    )
  }

  if (loading) {
    return <span className="text-xs text-gray-500">Checking…</span>
  }

  if (result && 'health_score' in result) {
    const score = result.health_score
    const color = healthColor(score)
    return (
      <span className="text-xs font-medium" style={{ color }}>
        Health: {(score * 100).toFixed(0)}%
      </span>
    )
  }

  return <span className="text-xs text-gray-500">Session not loaded</span>
}

function GraphCard({ graph }: { graph: GraphRegistryEntry }) {
  const navigate = useNavigate()
  const { setSessionId } = useSessionStore()

  const handleOpen = () => {
    setSessionId(graph.session_id)
    navigate('/')
  }

  return (
    <div className="bg-gray-900 border border-gray-800 rounded p-3 flex flex-col gap-2">
      <div className="flex items-start justify-between gap-2">
        <div>
          <h3 className="text-sm font-semibold text-gray-200">{graph.name}</h3>
          <p className="text-xs text-gray-500">{graph.session_id}</p>
        </div>
        {graph.public && (
          <span className="text-[10px] uppercase tracking-wide text-blue-400 bg-blue-950 px-1.5 py-0.5 rounded">
            Public
          </span>
        )}
      </div>

      {graph.description && (
        <p className="text-xs text-gray-400 line-clamp-3">
          {graph.description}
        </p>
      )}

      {formatTags(graph.tags).length > 0 && (
        <div className="flex flex-wrap gap-1">
          {formatTags(graph.tags).map((tag) => (
            <span
              key={tag}
              className="text-[10px] text-gray-400 bg-gray-800 px-1.5 py-0.5 rounded"
            >
              {tag}
            </span>
          ))}
        </div>
      )}

      <p className="text-[10px] text-gray-600">
        Updated {new Date(graph.updated_at).toLocaleString()}
      </p>

      <div className="flex items-center justify-between mt-1">
        <HealthBadge name={graph.name} />
        <button
          type="button"
          onClick={handleOpen}
          className="text-xs bg-blue-600 hover:bg-blue-500 text-white px-2 py-1 rounded"
        >
          Open in Graph
        </button>
      </div>
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
    isLoading,
    error,
    setQuery,
    setTag,
    setPublicOnly,
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

  return (
    <div className="h-full flex flex-col">
      <form
        onSubmit={handleSearchSubmit}
        className="flex items-center gap-2 px-4 py-3 border-b border-gray-800 flex-wrap"
      >
        <h2 className="text-sm font-semibold text-gray-200 mr-2">
          Graph Gallery
        </h2>
        <input
          type="text"
          placeholder="Search by name / description / tags…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="bg-gray-800 border border-gray-700 rounded px-2 py-1 w-64 text-xs text-gray-200"
        />
        <input
          type="text"
          placeholder="tag filter"
          value={tag}
          onChange={(e) => setTag(e.target.value)}
          className="bg-gray-800 border border-gray-700 rounded px-2 py-1 w-32 text-xs text-gray-200"
        />
        <label className="flex items-center gap-1 text-xs text-gray-400">
          <input
            type="checkbox"
            checked={publicOnly}
            onChange={(e) => setPublicOnly(e.target.checked)}
          />
          Public only
        </label>
        <button
          type="submit"
          disabled={isLoading}
          className="text-xs bg-gray-800 hover:bg-gray-700 text-gray-200 px-2 py-1 rounded disabled:opacity-50"
        >
          {isLoading ? 'Loading…' : 'Search'}
        </button>
      </form>

      {error && <p className="text-red-400 text-xs px-4 py-2">{error}</p>}

      {!error && !isLoading && graphs.length === 0 && (
        <p className="text-xs text-gray-500 px-4 py-3">
          Ничего не найдено. Графы попадают сюда через register_graph(...,
          public=true) — если ожидали что-то увидеть, проверьте, что граф
          действительно зарегистрирован как публичный.
        </p>
      )}

      <div className="flex-1 overflow-y-auto p-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 content-start">
        {graphs.map((graph) => (
          <GraphCard key={graph.name} graph={graph} />
        ))}
      </div>
    </div>
  )
}
