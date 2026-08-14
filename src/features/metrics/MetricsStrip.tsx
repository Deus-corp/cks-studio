// Copyright (c) 2026 Deus Corp. Licensed under MIT.

import { formatRelativeTime } from '@/shared/utils/formatUtils'
import { useMetricsStripPolling } from './useMetricsStripPolling'

const PLACEHOLDER = '—'

interface MetricChipProps {
  label: string
  value: number | null
  /** Показывается вместо числа, когда источник ответил, но метрика не
   *  поддерживается бэкендом (например outbox для dead-letter) -- это не
   *  то же самое, что "ещё не загружено" (PLACEHOLDER). */
  unsupported?: boolean
  error: string | null
  /** Подсвечивает значение как предупреждение (например ненулевой
   *  dead-letter counter), не блокируя рендер остальных чипов. */
  warnIfPositive?: boolean
}

function MetricChip({
  label,
  value,
  unsupported,
  error,
  warnIfPositive,
}: MetricChipProps) {
  const displayValue = unsupported
    ? 'n/a'
    : value === null
      ? PLACEHOLDER
      : String(value)

  const isWarning = warnIfPositive && typeof value === 'number' && value > 0

  return (
    <div
      className="flex-shrink-0 flex flex-col justify-center gap-0.5 bg-surface-1 border border-border-subtle rounded px-3 py-2 min-w-[112px]"
      title={
        error
          ? `Failed to fetch: ${error}`
          : unsupported
            ? 'Not supported by this storage backend'
            : undefined
      }
    >
      <span className="text-[11px] text-text-tertiary whitespace-nowrap">
        {label}
      </span>
      <span
        className={`text-lg font-semibold tabular-nums ${
          error
            ? 'text-text-tertiary'
            : isWarning
              ? 'text-yellow-400'
              : 'text-text-primary'
        }`}
      >
        {error ? PLACEHOLDER : displayValue}
      </span>
    </div>
  )
}

/**
 * Компактная строка ключевых операционных метрик — используется на
 * AgentsPage и PipelinePage, чтобы дать общее представление о состоянии
 * системы, не заходя в детальные панели ниже. Опрашивает список
 * источников независимо (см. useMetricsStripPolling) раз в 10с, с паузой
 * при скрытой вкладке.
 *
 * Счётчик задач пайплайна намеренно не включён: get_metrics() не отдаёт
 * готового счётчика outbox/pipeline задач (см. cks-mcp
 * get_metrics/handler.py — там только runtime/tool/LLM telemetry), а
 * выводить его из уже загруженных данных здесь не из чего.
 */
export function MetricsStrip() {
  const { data, lastFetchedAt, isLoading, errors } = useMetricsStripPolling()

  return (
    <div className="border-b border-border-subtle bg-surface-0">
      <div className="flex items-center gap-2 overflow-x-auto px-4 py-2">
        <MetricChip
          label="Graphs"
          value={data.graphsCount}
          error={errors.graphs}
        />
        <MetricChip
          label="Agents running"
          value={data.agentsRunningCount}
          error={errors.agents}
        />
        <MetricChip
          label="Processes alive"
          value={data.processesAliveCount}
          error={errors.processes}
        />
        <MetricChip
          label="Dead-letter tasks"
          value={data.deadLetterCount}
          unsupported={data.deadLetterUnsupported}
          error={errors.deadLetter}
          warnIfPositive
        />
        <span className="ml-auto flex-shrink-0 text-xs text-text-tertiary whitespace-nowrap">
          {isLoading && lastFetchedAt === null
            ? 'loading…'
            : lastFetchedAt
              ? `updated ${formatRelativeTime(lastFetchedAt.toISOString())}`
              : 'loading…'}
        </span>
      </div>
    </div>
  )
}
