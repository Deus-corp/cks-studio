// Copyright (c) 2025 Deus Corp. Licensed under MIT.

import { renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useSessionStore } from '../sessionStore'
import { useSessionEvents } from '../useSessionEvents'

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

function emitMessage(es: FakeEventSource, event: string, sessionId = 's1') {
  es.onmessage?.({
    data: JSON.stringify({
      event,
      session_id: sessionId,
      timestamp: '2026-01-01T00:00:00Z',
      detail: {},
    }),
  })
}

describe('useSessionEvents', () => {
  beforeEach(() => {
    FakeEventSource.instances = []
    vi.stubGlobal('EventSource', FakeEventSource)
    vi.useFakeTimers()
    window.localStorage.clear()
    useSessionStore.getState().reset()
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllGlobals()
  })

  it('does not connect when there is no session', () => {
    const onRefresh = vi.fn()
    renderHook(() => useSessionEvents({ onRefresh }))
    expect(FakeEventSource.instances).toHaveLength(0)
  })

  it('connects once a session is set, and calls onRefresh (debounced) on a matching event', () => {
    const onRefresh = vi.fn()
    useSessionStore.getState().setServerUrl('http://127.0.0.1:8765')
    useSessionStore.getState().setSessionId('s1')

    renderHook(() => useSessionEvents({ onRefresh, debounceMs: 300 }))
    expect(FakeEventSource.instances).toHaveLength(1)

    emitMessage(FakeEventSource.instances[0], 'VersionCreated')
    expect(onRefresh).not.toHaveBeenCalled()

    vi.advanceTimersByTime(300)
    expect(onRefresh).toHaveBeenCalledTimes(1)
  })

  it('coalesces multiple rapid events into a single onRefresh call', () => {
    const onRefresh = vi.fn()
    useSessionStore.getState().setServerUrl('http://127.0.0.1:8765')
    useSessionStore.getState().setSessionId('s1')

    renderHook(() => useSessionEvents({ onRefresh, debounceMs: 300 }))
    const es = FakeEventSource.instances[0]

    emitMessage(es, 'VersionCreated')
    vi.advanceTimersByTime(100)
    emitMessage(es, 'TransactionCommitted')
    vi.advanceTimersByTime(100)
    emitMessage(es, 'VersionCreated')
    vi.advanceTimersByTime(300)

    expect(onRefresh).toHaveBeenCalledTimes(1)
  })

  it('does not connect in demo mode', () => {
    const onRefresh = vi.fn()
    useSessionStore.getState().setServerUrl('demo://static')
    useSessionStore.getState().setSessionId('demo-session')

    renderHook(() => useSessionEvents({ onRefresh }))
    expect(FakeEventSource.instances).toHaveLength(0)
  })

  it('closes the old connection and opens a new one when sessionId changes', () => {
    useSessionStore.getState().setServerUrl('http://127.0.0.1:8765')
    useSessionStore.getState().setSessionId('s1')
    const onRefresh = vi.fn()

    const { rerender } = renderHook(() => useSessionEvents({ onRefresh }))
    expect(FakeEventSource.instances).toHaveLength(1)
    const first = FakeEventSource.instances[0]

    useSessionStore.getState().setSessionId('s2')
    rerender()

    expect(first.closed).toBe(true)
    expect(FakeEventSource.instances).toHaveLength(2)
    expect(FakeEventSource.instances[1].url).toContain('session_id=s2')
  })

  it('closes the connection on unmount', () => {
    useSessionStore.getState().setServerUrl('http://127.0.0.1:8765')
    useSessionStore.getState().setSessionId('s1')
    const onRefresh = vi.fn()

    const { unmount } = renderHook(() => useSessionEvents({ onRefresh }))
    const es = FakeEventSource.instances[0]
    expect(es.closed).toBe(false)

    unmount()
    expect(es.closed).toBe(true)
  })
})
