// Copyright (c) 2025 Deus Corp. Licensed under MIT.

import { create } from 'zustand'
import {
  DEFAULT_MCP_SERVER_URL,
  type RecentSession,
  readRecentSessions,
  readStoredServerUrl,
  readStoredSessionId,
  removeRecentSession,
  writeRecentSession,
  writeStoredServerUrl,
  writeStoredSessionId,
} from './connectionConfig'
import { setMCPBaseUrl } from './mcpClient'

/**
 * Общий стор соединения с cks-mcp: server URL + текущая сессия.
 *
 * До этого коммита server URL и session ID жили как локальный useState
 * внутри GraphPage — при переходе на другую страницу (Pipeline Monitor,
 * Graph Gallery) их пришлось бы дублировать или тащить через props.
 * Теперь это единый источник правды, персистится в localStorage, и любая
 * страница может им пользоваться независимо.
 */
export type ConnectionStatus = 'idle' | 'connecting' | 'connected' | 'error'

export interface SessionState {
  serverUrl: string
  sessionId: string
  status: ConnectionStatus
  error: string | null
  recentSessions: RecentSession[]
  setServerUrl: (url: string) => void
  setSessionId: (sessionId: string) => void
  setStatus: (status: ConnectionStatus) => void
  setError: (error: string | null) => void
  /** Записывает текущее (serverUrl, sessionId) в историю подключений.
   *  Вызывать при успешном connect, а не при каждом вводе sessionId. */
  recordConnection: () => void
  reset: () => void
}

const initialServerUrl = readStoredServerUrl()
// Синхронизируем mcpClient сразу при инициализации модуля, чтобы первый
// вызов callTool() (до любого явного connect) уже шёл на правильный URL.
setMCPBaseUrl(initialServerUrl)

export const useSessionStore = create<SessionState>((set) => ({
  serverUrl: initialServerUrl,
  sessionId: readStoredSessionId(),
  status: 'idle',
  error: null,
  recentSessions: readRecentSessions(),
  setServerUrl: (url) => {
    writeStoredServerUrl(url)
    setMCPBaseUrl(url)
    set({ serverUrl: url })
  },
  setSessionId: (sessionId) => {
    writeStoredSessionId(sessionId)
    set({ sessionId })
  },
  setStatus: (status) => set({ status }),
  setError: (error) =>
    set((state) => {
      if (!error || !state.sessionId.trim()) {
        return { error, status: error ? 'error' : 'idle' }
      }
      // A failed connection means this (serverUrl, sessionId) pair is
      // currently unreachable -- drop it from "Recent sessions" so
      // dead IDs don't sit there tempting a re-click. If the same
      // session becomes reachable again later, recordConnection() on a
      // successful connect adds it right back.
      return {
        error,
        status: 'error',
        recentSessions: removeRecentSession({
          serverUrl: state.serverUrl,
          sessionId: state.sessionId,
        }),
      }
    }),
  recordConnection: () =>
    set((state) => ({
      recentSessions: writeRecentSession({
        serverUrl: state.serverUrl,
        sessionId: state.sessionId,
      }),
    })),
  reset: () =>
    set({
      serverUrl: DEFAULT_MCP_SERVER_URL,
      sessionId: '',
      status: 'idle',
      error: null,
    }),
}))
