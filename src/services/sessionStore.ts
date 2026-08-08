// Copyright (c) 2025 Deus Corp. Licensed under MIT.

import { create } from 'zustand'
import {
  DEFAULT_MCP_SERVER_URL,
  readStoredServerUrl,
  readStoredSessionId,
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
  setServerUrl: (url: string) => void
  setSessionId: (sessionId: string) => void
  setStatus: (status: ConnectionStatus) => void
  setError: (error: string | null) => void
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
  setError: (error) => set({ error, status: error ? 'error' : 'idle' }),
  reset: () =>
    set({
      serverUrl: DEFAULT_MCP_SERVER_URL,
      sessionId: '',
      status: 'idle',
      error: null,
    }),
}))
