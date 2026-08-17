// Copyright (c) 2026 Deus Corp. Licensed under MIT.

import { useCallback, useEffect, useRef, useState } from 'react'
import {
  type DeadLetterTask,
  listDeadLetteredConflicts,
} from '@/services/mcpTools'

const DEFAULT_INTERVAL_MS = 15_000

interface UseDeadLetterPollingResult {
  tasks: DeadLetterTask[]
  /** false once we've learned the connected storage backend has no
   *  outbox support (e.g. the default in-memory backend) -- distinct
   *  from tasks simply being empty. Starts true until the first fetch
   *  resolves. */
  supported: boolean
  lastFetchedAt: Date | null
  error: string | null
  isLoading: boolean
  refresh: () => Promise<void>
}

/**
 * Polls list_dead_lettered_conflicts on an interval, same
 * pause-when-hidden pattern as useAgentsPolling (agent-panel) --
 * dead-lettered tasks only accumulate when a Critic agent gives up, so
 * this doesn't need to be aggressive, just not stale when the operator
 * comes back to check.
 */
export function useDeadLetterPolling(
  intervalMs = DEFAULT_INTERVAL_MS,
  /** When set, only dead-lettered tasks for this session are fetched
   *  (passed through to list_dead_lettered_conflicts' session_id
   *  filter). Undefined/empty means "all sessions". */
  sessionId?: string,
): UseDeadLetterPollingResult {
  const [tasks, setTasks] = useState<DeadLetterTask[]>([])
  const [supported, setSupported] = useState(true)
  const [lastFetchedAt, setLastFetchedAt] = useState<Date | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)

  // Same race guard as useAgentsPolling: an in-flight request started
  // earlier must not clobber a more recent one's result.
  const requestSeq = useRef(0)

  const refresh = useCallback(async () => {
    const seq = ++requestSeq.current
    setIsLoading(true)
    try {
      const result = await listDeadLetteredConflicts(undefined, sessionId)
      if (seq !== requestSeq.current) return
      // Defensive: listDeadLetteredConflicts already normalizes this,
      // but never let a missing/non-array `tasks` reach state -- a
      // stale/mocked response shape should not crash the panel.
      setTasks(Array.isArray(result.tasks) ? result.tasks : [])
      setSupported(result.supported)
      setLastFetchedAt(new Date())
      setError(null)
    } catch (e) {
      if (seq !== requestSeq.current) return
      setError(e instanceof Error ? e.message : 'Unknown error')
    } finally {
      if (seq === requestSeq.current) setIsLoading(false)
    }
  }, [sessionId])

  useEffect(() => {
    refresh()

    let timer: ReturnType<typeof setInterval> | null = null

    const startPolling = () => {
      if (timer !== null) return
      timer = setInterval(refresh, intervalMs)
    }
    const stopPolling = () => {
      if (timer === null) return
      clearInterval(timer)
      timer = null
    }

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        refresh()
        startPolling()
      } else {
        stopPolling()
      }
    }

    if (document.visibilityState === 'visible') startPolling()
    document.addEventListener('visibilitychange', handleVisibilityChange)

    return () => {
      stopPolling()
      document.removeEventListener('visibilitychange', handleVisibilityChange)
    }
  }, [refresh, intervalMs])

  return { tasks, supported, lastFetchedAt, error, isLoading, refresh }
}
