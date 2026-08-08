// Copyright (c) 2025 Deus Corp. Licensed under MIT.

/** Разбирает comma-separated tags (как хранится в graph_registry) в массив. */
export function formatTags(tags: string): string[] {
  return tags
    .split(',')
    .map((t) => t.trim())
    .filter(Boolean)
}

/** Цвет health-бэйджа по health_score (0..1), см. check_graph_health. */
export function healthColor(score: number): string {
  if (score >= 0.8) return '#10b981'
  if (score >= 0.5) return '#f59e0b'
  return '#ef4444'
}
