// Copyright (c) 2025 Deus Corp. Licensed under MIT.

import { beforeEach, describe, expect, it } from 'vitest'
import { DEFAULT_MCP_SERVER_URL } from '../connectionConfig'
import { useSessionStore } from '../sessionStore'

describe('useSessionStore', () => {
  beforeEach(() => {
    window.localStorage.clear()
    useSessionStore.getState().reset()
  })

  it('starts with default server url and empty session', () => {
    const state = useSessionStore.getState()
    expect(state.serverUrl).toBe(DEFAULT_MCP_SERVER_URL)
    expect(state.sessionId).toBe('')
    expect(state.status).toBe('idle')
  })

  it('persists serverUrl and sessionId to localStorage', () => {
    useSessionStore.getState().setServerUrl('http://example.com:9000')
    useSessionStore.getState().setSessionId('session-42')

    expect(window.localStorage.getItem('cks-studio:mcp-server-url')).toBe(
      'http://example.com:9000',
    )
    expect(window.localStorage.getItem('cks-studio:session-id')).toBe(
      'session-42',
    )
  })

  it('setError sets status to error, and clears it back to idle on null', () => {
    useSessionStore.getState().setError('boom')
    expect(useSessionStore.getState().status).toBe('error')
    expect(useSessionStore.getState().error).toBe('boom')

    useSessionStore.getState().setError(null)
    expect(useSessionStore.getState().status).toBe('idle')
    expect(useSessionStore.getState().error).toBeNull()
  })

  it('setStatus does not clobber an unrelated error message', () => {
    useSessionStore.getState().setError('boom')
    useSessionStore.getState().setStatus('connecting')
    expect(useSessionStore.getState().status).toBe('connecting')
  })

  it('setError prunes the current session from recentSessions', () => {
    useSessionStore.getState().setServerUrl('http://example.com:9000')
    useSessionStore.getState().setSessionId('session-dead')
    useSessionStore.getState().recordConnection()
    expect(
      useSessionStore
        .getState()
        .recentSessions.some((r) => r.sessionId === 'session-dead'),
    ).toBe(true)

    useSessionStore.getState().setError('connection refused')

    expect(
      useSessionStore
        .getState()
        .recentSessions.some((r) => r.sessionId === 'session-dead'),
    ).toBe(false)
  })

  it('setError with no active sessionId leaves recentSessions untouched', () => {
    useSessionStore.getState().setServerUrl('http://example.com:9000')
    useSessionStore.getState().setSessionId('session-ok')
    useSessionStore.getState().recordConnection()
    useSessionStore.getState().setSessionId('')

    useSessionStore.getState().setError('boom')

    expect(
      useSessionStore
        .getState()
        .recentSessions.some((r) => r.sessionId === 'session-ok'),
    ).toBe(true)
  })
})
