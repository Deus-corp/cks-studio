// Copyright (c) 2025 Deus Corp. Licensed under MIT.

import { useEffect, useRef } from 'react'
import { connectSessionEvents, type SessionEventMessage } from './sessionEvents'
import { useSessionStore } from './sessionStore'

export interface UseSessionEventsOptions {
  /** Called (debounced/coalesced) when a graph-affecting event arrives.
   *  Typically the same refresh function the manual refresh button
   *  calls (e.g. re-running getFullGraph for the current session). */
  onRefresh: () => void
  /** Debounce window in ms: multiple events within this window collapse
   *  into a single onRefresh() call. Defaults to 400ms. */
  debounceMs?: number
  /** Restrict to specific event types; defaults to sessionEvents.ts's
   *  GRAPH_AFFECTING_EVENT_TYPES via connectSessionEvents' own default. */
  eventTypes?: readonly string[] | null
}

/**
 * Subscribes to real-time session events (SSE) for the current session
 * (read from useSessionStore) and calls `onRefresh` -- debounced -- when
 * a graph-affecting event arrives.
 *
 * Connection lifecycle:
 *  - Opens when `sessionId` is non-empty and `serverUrl` is a real
 *    server (not the demo sentinel — see sessionEvents.ts).
 *  - Closes and reopens whenever `sessionId` or `serverUrl` changes.
 *  - Closes on unmount.
 *
 * Intended to be mounted once near the top of the real (non-demo)
 * studio app, e.g. in GraphPage, so it's active whenever a session is
 * connected without every page needing to wire it up separately.
 */
export function useSessionEvents({
  onRefresh,
  debounceMs = 400,
  eventTypes,
}: UseSessionEventsOptions): void {
  const serverUrl = useSessionStore((state) => state.serverUrl)
  const sessionId = useSessionStore((state) => state.sessionId)

  // Keep the latest onRefresh in a ref so the connection effect below
  // doesn't need onRefresh in its dependency array -- callers that
  // don't memoize their refresh function (the common case: an inline
  // closure over local component state) would otherwise cause a
  // reconnect on every render.
  const onRefreshRef = useRef(onRefresh)
  onRefreshRef.current = onRefresh

  useEffect(() => {
    if (!sessionId.trim()) return

    let debounceTimer: ReturnType<typeof setTimeout> | null = null
    const handleMessage = (_message: SessionEventMessage) => {
      if (debounceTimer !== null) clearTimeout(debounceTimer)
      debounceTimer = setTimeout(() => {
        debounceTimer = null
        onRefreshRef.current()
      }, debounceMs)
    }

    const connection = connectSessionEvents({
      serverUrl,
      sessionId,
      eventTypes,
      onMessage: handleMessage,
    })

    return () => {
      if (debounceTimer !== null) clearTimeout(debounceTimer)
      connection.close()
    }
  }, [serverUrl, sessionId, debounceMs, eventTypes])
}
