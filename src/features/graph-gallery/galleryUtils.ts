// Copyright (c) 2025 Deus Corp. Licensed under MIT.

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
