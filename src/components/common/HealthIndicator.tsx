// Copyright (c) 2025 Deus Corp. Licensed under MIT.

import { healthColor } from '@/features/graph-gallery/galleryUtils'
import type {
  GraphHealthResult,
  GraphHealthUnavailable,
} from '@/shared/types/graph'

/**
 * Индикатор здоровья графа по результату check_graph_health.
 * Извлечено из features/graph-gallery/GraphGallery.tsx (там раньше был
 * инлайн-компонент HealthBadge с той же логикой) — вынесено сюда, чтобы
 * им могли пользоваться и другие места (например, будущая страница деталей
 * графа), не завязываясь на useGalleryStore.
 *
 * Это чистый презентационный компонент: сам не делает запросов, только
 * рисует состояние (idle / loading / result) и отдаёт наружу onCheck.
 */
export function HealthIndicator({
  result,
  loading,
  onCheck,
}: {
  result: GraphHealthResult | GraphHealthUnavailable | undefined
  loading: boolean
  onCheck: () => void
}) {
  if (!result && !loading) {
    return (
      <button
        type="button"
        onClick={onCheck}
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
