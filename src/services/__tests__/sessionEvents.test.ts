// Copyright (c) 2025 Deus Corp. Licensed under MIT.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  connectSessionEvents,
  DEMO_SERVER_URL,
  GRAPH_AFFECTING_EVENT_TYPES,
} from '../sessionEvents'

/** Minimal EventSource stand-in that records the constructed URL and
 *  lets tests drive onopen/onmessage/onerror manually. Registered on
 *  the last-constructed-instance list so tests can grab it. */
class FakeEventSource {
  static instances: FakeEventSource[] = []
  url: string
  onopen: (() => void) | null = null
  onmessage: ((ev: { data: string }) => void) | null = null
  onerror: (() => void) | null = null
  closed = false

  constructor(url: string) {
    this.url = url
    FakeEventSource.instances.push(this)
  }

  close() {
    this.closed = true
  }
}

describe('connectSessionEvents', () => {
  beforeEach(() => {
    FakeEventSource.instances = []
    vi.stubGlobal('EventSource', FakeEventSource)
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllGlobals()
  })

  it('does not open a connection in demo mode', () => {
    const onMessage = vi.fn()
    connectSessionEvents({
      serverUrl: DEMO_SERVER_URL,
      sessionId: 's1',
      onMessage,
    })
    expect(FakeEventSource.instances).toHaveLength(0)
  })

  it('does not open a connection when sessionId is empty', () => {
    const onMessage = vi.fn()
    connectSessionEvents({
      serverUrl: 'http://127.0.0.1:8765',
      sessionId: '   ',
      onMessage,
    })
    expect(FakeEventSource.instances).toHaveLength(0)
  })

  it('builds the events URL from serverUrl and sessionId, trimming trailing slash', () => {
    connectSessionEvents({
      serverUrl: 'http://127.0.0.1:8765/',
      sessionId: 'abc def',
      onMessage: vi.fn(),
    })
    const es = FakeEventSource.instances[0]
    expect(es.url.startsWith('http://127.0.0.1:8765/events?')).toBe(true)
    expect(es.url).toContain('session_id=abc+def')
    expect(es.url).toContain(
      `event_types=${GRAPH_AFFECTING_EVENT_TYPES.join('%2C')}`,
    )
  })

  it('parses messages and forwards event_types-matching ones to onMessage', () => {
    const onMessage = vi.fn()
    connectSessionEvents({
      serverUrl: 'http://127.0.0.1:8765',
      sessionId: 's1',
      onMessage,
    })
    const es = FakeEventSource.instances[0]

    es.onmessage?.({
      data: JSON.stringify({
        event: 'VersionCreated',
        session_id: 's1',
        timestamp: '2026-01-01T00:00:00Z',
        detail: {},
      }),
    })
    expect(onMessage).toHaveBeenCalledTimes(1)
    expect(onMessage.mock.calls[0][0].event).toBe('VersionCreated')
  })

  it('filters out event types not in the allow-list', () => {
    const onMessage = vi.fn()
    connectSessionEvents({
      serverUrl: 'http://127.0.0.1:8765',
      sessionId: 's1',
      onMessage,
      eventTypes: ['VersionCreated'],
    })
    const es = FakeEventSource.instances[0]

    es.onmessage?.({
      data: JSON.stringify({
        event: 'SessionCreated',
        session_id: 's1',
        timestamp: '2026-01-01T00:00:00Z',
        detail: {},
      }),
    })
    expect(onMessage).not.toHaveBeenCalled()
  })

  it('ignores malformed JSON frames without throwing', () => {
    const onMessage = vi.fn()
    connectSessionEvents({
      serverUrl: 'http://127.0.0.1:8765',
      sessionId: 's1',
      onMessage,
    })
    const es = FakeEventSource.instances[0]
    expect(() => es.onmessage?.({ data: 'not json' })).not.toThrow()
    expect(onMessage).not.toHaveBeenCalled()
  })

  it('reconnects with backoff after an error', () => {
    connectSessionEvents({
      serverUrl: 'http://127.0.0.1:8765',
      sessionId: 's1',
      onMessage: vi.fn(),
      reconnectBaseMs: 100,
      reconnectMaxMs: 1000,
    })
    expect(FakeEventSource.instances).toHaveLength(1)
    const first = FakeEventSource.instances[0]

    first.onerror?.()
    expect(first.closed).toBe(true)
    expect(FakeEventSource.instances).toHaveLength(1) // not reconnected yet

    vi.advanceTimersByTime(100)
    expect(FakeEventSource.instances).toHaveLength(2)
  })

  it('does not reconnect after close() is called', () => {
    const connection = connectSessionEvents({
      serverUrl: 'http://127.0.0.1:8765',
      sessionId: 's1',
      onMessage: vi.fn(),
      reconnectBaseMs: 100,
    })
    const first = FakeEventSource.instances[0]
    connection.close()
    expect(first.closed).toBe(true)

    first.onerror?.()
    vi.advanceTimersByTime(5000)
    expect(FakeEventSource.instances).toHaveLength(1)
  })

  it('close() before any error also prevents future connections', () => {
    const connection = connectSessionEvents({
      serverUrl: 'http://127.0.0.1:8765',
      sessionId: 's1',
      onMessage: vi.fn(),
    })
    connection.close()
    expect(FakeEventSource.instances[0].closed).toBe(true)
    vi.advanceTimersByTime(20000)
    expect(FakeEventSource.instances).toHaveLength(1)
  })
})
