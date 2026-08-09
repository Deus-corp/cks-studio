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

/**
 * Относительное время вида "3m ago" / "2h ago" для панели агентов —
 * абсолютный timestamp неудобно читать, когда нужно быстро понять "давно
 * ли был последний прогон". Намеренно грубая точность (минуты/часы/дни),
 * секунды не нужны для sweeper'ов с интервалом от нескольких минут.
 *
 * ВАЖНО: для sweeper'а с большим interval_seconds (например graph_health —
 * час) старое значение last_run_at — это норма, а не признак зависания;
 * эта функция сама по себе не может отличить "зависший" от "просто редко
 * запускается" — это решает вызывающий код (см. AgentCard).
 */
export function formatRelativeTime(iso: string | null): string {
  if (!iso) return 'never'

  const then = new Date(iso).getTime()
  if (Number.isNaN(then)) return 'never'

  const diffMs = Date.now() - then
  if (diffMs < 0) return 'just now'

  const diffSeconds = Math.floor(diffMs / 1000)
  if (diffSeconds < 60) return 'just now'

  const diffMinutes = Math.floor(diffSeconds / 60)
  if (diffMinutes < 60) return `${diffMinutes}m ago`

  const diffHours = Math.floor(diffMinutes / 60)
  if (diffHours < 24) return `${diffHours}h ago`

  const diffDays = Math.floor(diffHours / 24)
  return `${diffDays}d ago`
}
