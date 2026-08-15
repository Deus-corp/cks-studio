// Copyright (c) 2025 Deus Corp. Licensed under MIT.

import type { GraphRegistryEntry } from '@/shared/types/graph'
import { scoreColor } from '@/shared/utils/colorUtils'

/** Разбирает comma-separated tags (как хранится в graph_registry) в массив. */
export function formatTags(tags: string): string[] {
  return tags
    .split(',')
    .map((t) => t.trim())
    .filter(Boolean)
}

/**
 * Цвет health-бэйджа по health_score (0..1), см. check_graph_health.
 * Реэкспорт shared/utils/colorUtils::scoreColor под привычным для этого
 * фича-модуля именем — сохраняет существующие импорты/тесты рабочими.
 */
export const healthColor = scoreColor

export type GallerySortOrder = 'updated_desc' | 'name_asc' | 'name_desc'

export const SORT_OPTIONS: { value: GallerySortOrder; label: string }[] = [
  { value: 'updated_desc', label: 'Most recently updated' },
  { value: 'name_asc', label: 'Name A-Z' },
  { value: 'name_desc', label: 'Name Z-A' },
]

/**
 * Объединение всех тегов из текущего (уже отфильтрованного бэкендом)
 * списка графов, отсортированное по алфавиту без дублей — источник для
 * чипов быстрого фильтра в тулбаре галереи.
 */
export function collectTags(graphs: GraphRegistryEntry[]): string[] {
  const tags = new Set<string>()
  for (const graph of graphs) {
    for (const tag of formatTags(graph.tags)) {
      tags.add(tag)
    }
  }
  return Array.from(tags).sort((a, b) => a.localeCompare(b))
}

/**
 * Чисто клиентская сортировка (бэкенд list_graphs/search_graphs уже
 * возвращает most-recently-updated-first, но не даёт сортировку по
 * имени) — не мутирует исходный массив.
 */
export function sortGraphs(
  graphs: GraphRegistryEntry[],
  order: GallerySortOrder,
): GraphRegistryEntry[] {
  const sorted = [...graphs]
  switch (order) {
    case 'name_asc':
      return sorted.sort((a, b) => a.name.localeCompare(b.name))
    case 'name_desc':
      return sorted.sort((a, b) => b.name.localeCompare(a.name))
    default:
      return sorted.sort(
        (a, b) =>
          new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime(),
      )
  }
}
