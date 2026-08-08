// Copyright (c) 2025 Deus Corp. Licensed under MIT.

import { formatStatusLabel } from '@/shared/utils/formatUtils'

/**
 * Цветная плашка статуса пайплайна (structure.current_status, ADR-007).
 * Извлечено из инлайн-разметки в SidePanel.tsx, которая дублировала эту
 * же плашку под каждый узел с transition_log.
 */
export function StatusBadge({
  status,
  color,
}: {
  status: string
  color: string
}) {
  return (
    <span
      className="text-sm font-medium px-2 py-0.5 rounded"
      style={{ backgroundColor: color }}
    >
      {formatStatusLabel(status)}
    </span>
  )
}
