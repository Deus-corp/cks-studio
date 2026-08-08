// Copyright (c) 2025 Deus Corp. Licensed under MIT.

import {
  type ConnectionStatus as Status,
  useSessionStore,
} from '@/services/sessionStore'

const STATUS_COLORS: Record<Status, string> = {
  idle: '#6b7280',
  connecting: '#f59e0b',
  connected: '#10b981',
  error: '#ef4444',
}

const STATUS_LABELS: Record<Status, string> = {
  idle: 'Not connected',
  connecting: 'Connecting…',
  connected: 'Connected',
  error: 'Connection error',
}

/**
 * Индикатор состояния подключения к cks-mcp (useSessionStore().status) —
 * цветная точка + подпись. До этого статус был виден только косвенно, по
 * тексту ошибки под шапкой GraphPage; сам ConnectionStatus (idle/connecting/
 * connected) нигде не отображался.
 */
export function ConnectionStatus() {
  const status = useSessionStore((s) => s.status)
  return (
    <span className="flex items-center gap-1.5 text-xs text-gray-400">
      <span
        className="h-2 w-2 rounded-full"
        style={{
          backgroundColor: STATUS_COLORS[status],
          ...(status === 'connecting'
            ? { animation: 'pulse 1.5s ease-in-out infinite' }
            : {}),
        }}
      />
      {STATUS_LABELS[status]}
    </span>
  )
}
