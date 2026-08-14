// Copyright (c) 2025 Deus Corp. Licensed under MIT.

/**
 * Framework-agnostic wrapper around the cks-mcp `/events` SSE endpoint
 * (see cks-mcp's src/cks_mcp/http_events.py). Kept free of React so it
 * can be unit-tested without rendering a component, and so
 * useSessionEvents.ts (the React hook) stays a thin adapter.
 *
 * Demo mode: the static demo (src/demo.tsx) sets sessionStore's
 * serverUrl to DEMO_SERVER_URL and never has a live cks-mcp server to
 * talk to, so `connectSessionEvents` refuses to open an EventSource in
 * that case -- see `isDemoServerUrl`.
 */

/** Sentinel serverUrl used by the static demo build (see mockClient.ts). */
export const DEMO_SERVER_URL = 'demo://static'

export function isDemoServerUrl(serverUrl: string): boolean {
  return serverUrl === DEMO_SERVER_URL
}

/** Event types that affect the graph and should trigger a refresh.
 *  Kept in sync with cks-mcp's RuntimeEvent subclasses that mutate or
 *  reveal changes to session state (see cks-mcp README's HTTP
 *  transport section for the full event list). */
export const GRAPH_AFFECTING_EVENT_TYPES = [
  'VersionCreated',
  'TransactionCommitted',
  'GossipConflictDetected',
  'CRDTForkDetected',
  'AgentStepCompleted',
] as const

export interface SessionEventMessage {
  event: string
  session_id: string | null
  timestamp: string
  detail: Record<string, unknown>
}

export interface ConnectSessionEventsOptions {
  serverUrl: string
  sessionId: string
  /** Called for every parsed message that survives event_types filtering. */
  onMessage: (message: SessionEventMessage) => void
  /** Called whenever the connection (re)opens successfully. Optional. */
  onOpen?: () => void
  /** Only these event types are delivered to onMessage. Defaults to
   *  GRAPH_AFFECTING_EVENT_TYPES. Pass null to receive every event type. */
  eventTypes?: readonly string[] | null
  /** Base reconnect delay in ms; doubles up to a small ceiling on
   *  repeated failures. Defaults to 1000ms / 10s ceiling. */
  reconnectBaseMs?: number
  reconnectMaxMs?: number
}

export interface SessionEventsConnection {
  /** Closes the EventSource and cancels any pending reconnect timer. */
  close: () => void
}

function buildEventsUrl(
  serverUrl: string,
  sessionId: string,
  eventTypes: readonly string[] | null | undefined,
): string {
  const base = serverUrl.replace(/\/$/, '')
  const params = new URLSearchParams({ session_id: sessionId })
  if (eventTypes && eventTypes.length > 0) {
    params.set('event_types', eventTypes.join(','))
  }
  return `${base}/events?${params.toString()}`
}

/**
 * Opens an EventSource against `${serverUrl}/events?session_id=...` and
 * reconnects with exponential backoff on error, for as long as the
 * connection is open (i.e. until `close()` is called). Returns
 * immediately with a handle rather than a Promise -- there is no
 * single "connected" moment worth awaiting, since reconnects are
 * expected and handled internally.
 *
 * Does nothing (returns a no-op handle) when:
 *  - `sessionId` is empty, or
 *  - `serverUrl` is the demo sentinel (see isDemoServerUrl), or
 *  - `EventSource` is unavailable (non-browser environment).
 */
export function connectSessionEvents(
  options: ConnectSessionEventsOptions,
): SessionEventsConnection {
  const {
    serverUrl,
    sessionId,
    onMessage,
    onOpen,
    eventTypes = GRAPH_AFFECTING_EVENT_TYPES,
    reconnectBaseMs = 1000,
    reconnectMaxMs = 10000,
  } = options

  if (
    !sessionId.trim() ||
    isDemoServerUrl(serverUrl) ||
    typeof EventSource === 'undefined'
  ) {
    return { close: () => {} }
  }

  let closed = false
  let source: EventSource | null = null
  let reconnectTimer: ReturnType<typeof setTimeout> | null = null
  let attempt = 0

  const allowedTypes = eventTypes ? new Set(eventTypes) : null

  const clearReconnectTimer = () => {
    if (reconnectTimer !== null) {
      clearTimeout(reconnectTimer)
      reconnectTimer = null
    }
  }

  const scheduleReconnect = () => {
    if (closed) return
    clearReconnectTimer()
    const delay = Math.min(reconnectBaseMs * 2 ** attempt, reconnectMaxMs)
    attempt += 1
    reconnectTimer = setTimeout(open, delay)
  }

  function open() {
    if (closed) return
    const url = buildEventsUrl(serverUrl, sessionId, eventTypes)
    const es = new EventSource(url)
    source = es

    es.onopen = () => {
      attempt = 0
      onOpen?.()
    }

    es.onmessage = (ev: MessageEvent<string>) => {
      let parsed: SessionEventMessage
      try {
        parsed = JSON.parse(ev.data)
      } catch {
        // Malformed frame -- ignore rather than crash the stream.
        return
      }
      if (allowedTypes && !allowedTypes.has(parsed.event)) return
      onMessage(parsed)
    }

    es.onerror = () => {
      // EventSource auto-retries on transient network errors, but its
      // built-in retry can wedge in `readyState === CLOSED` after some
      // server-side failures (e.g. the dev server restarting), so we
      // close it ourselves and reconnect with backoff instead of
      // relying on the browser's default behaviour.
      es.close()
      if (source === es) source = null
      scheduleReconnect()
    }
  }

  open()

  return {
    close: () => {
      closed = true
      clearReconnectTimer()
      source?.close()
      source = null
    },
  }
}
