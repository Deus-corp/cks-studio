// Copyright (c) 2025 Deus Corp. Licensed under MIT.

/**
 * Добавляет alpha-канал к hex-цвету вида "#rrggbb" в виде двух hex-цифр
 * (00-ff), не трогая формат. Используется для полупрозрачной заливки под
 * цвет обводки узла графа (см. CksNode.tsx), где раньше alpha просто
 * приклеивался как магическая строка `${color}20`.
 *
 * alpha принимается в диапазоне 0-1 для удобства вызова; значение вне
 * диапазона обрезается.
 */
export function withAlpha(hexColor: string, alpha: number): string {
  const clamped = Math.max(0, Math.min(1, alpha))
  const hex = Math.round(clamped * 255)
    .toString(16)
    .padStart(2, '0')
  return `${hexColor}${hex}`
}

/**
 * Цвет по нормализованному скору 0..1 (health_score, любой другой скор
 * той же формы) в виде светофора: red -> amber -> green. Раньше это была
 * копия под конкретным именем healthColor только в features/graph-gallery
 * (см. её реэкспорт там для обратной совместимости с существующими
 * импортами/тестами).
 */
export function scoreColor(score: number): string {
  if (score >= 0.8) return '#10b981'
  if (score >= 0.5) return '#f59e0b'
  return '#ef4444'
}
