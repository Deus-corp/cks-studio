// Copyright (c) 2025 Deus Corp. Licensed under MIT.

/**
 * Человекочитаемая форма snake_case-значения статуса/поля структуры,
 * например "awaiting_review" -> "awaiting review". Используется везде,
 * где в CKS-структуре встречаются status/action/transitioned_to и т.п.
 * (см. SidePanel.tsx, PipelineMonitor.tsx).
 */
export function formatStatusLabel(value: string): string {
  return value.replace(/_/g, ' ')
}

/**
 * Короткая дата (без времени) для карточек, где важен только день —
 * например updated_at в Graph Gallery.
 */
export function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString()
}

/**
 * Дата и время — для мест, где важна и хронология в рамках дня, например
 * "Updated" в карточке графа или таймстемп версии форка.
 */
export function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString()
}
