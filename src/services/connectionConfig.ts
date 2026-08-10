// Copyright (c) 2025 Deus Corp. Licensed under MIT.

/**
 * Дефолты и persistence-хелперы для конфигурации подключения к cks-mcp.
 *
 * Зачем отдельный модуль, а не просто localStorage.getItem() в компонентах:
 * - единая точка правды для ключей localStorage (не рассыпать строковые
 *   литералы по компонентам — легко опечататься и словить "рассинхрон");
 * - safe fallback, если localStorage недоступен (SSR, приватный режим
 *   браузера, тесты в jsdom без storage) — тогда просто используем дефолты
 *   и не роняем приложение.
 */

export const DEFAULT_MCP_SERVER_URL = 'http://127.0.0.1:8765'

const STORAGE_KEYS = {
  serverUrl: 'cks-studio:mcp-server-url',
  sessionId: 'cks-studio:session-id',
  recentSessions: 'cks-studio:recent-sessions',
} as const

export const MAX_RECENT_SESSIONS = 5

export interface RecentSession {
  serverUrl: string
  sessionId: string
  lastUsed: number
}

/** Проверяет доступность localStorage (может отсутствовать/бросать исключение). */
function isStorageAvailable(): boolean {
  try {
    const testKey = '__cks_studio_storage_test__'
    window.localStorage.setItem(testKey, '1')
    window.localStorage.removeItem(testKey)
    return true
  } catch {
    return false
  }
}

const storageAvailable = typeof window !== 'undefined' && isStorageAvailable()

export function readStoredServerUrl(): string {
  if (!storageAvailable) return DEFAULT_MCP_SERVER_URL
  return (
    window.localStorage.getItem(STORAGE_KEYS.serverUrl) ||
    DEFAULT_MCP_SERVER_URL
  )
}

export function writeStoredServerUrl(url: string): void {
  if (!storageAvailable) return
  window.localStorage.setItem(STORAGE_KEYS.serverUrl, url)
}

export function readStoredSessionId(): string {
  if (!storageAvailable) return ''
  return window.localStorage.getItem(STORAGE_KEYS.sessionId) || ''
}

export function writeStoredSessionId(sessionId: string): void {
  if (!storageAvailable) return
  window.localStorage.setItem(STORAGE_KEYS.sessionId, sessionId)
}

export function readRecentSessions(): RecentSession[] {
  if (!storageAvailable) return []
  try {
    const raw = window.localStorage.getItem(STORAGE_KEYS.recentSessions)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed
  } catch {
    return []
  }
}

/** Добавляет/поднимает запись наверх истории подключений (по паре
 *  serverUrl+sessionId), обрезая список до MAX_RECENT_SESSIONS. */
export function writeRecentSession(entry: {
  serverUrl: string
  sessionId: string
}): RecentSession[] {
  if (!storageAvailable) return []
  const existing = readRecentSessions().filter(
    (s) =>
      !(s.serverUrl === entry.serverUrl && s.sessionId === entry.sessionId),
  )
  const next = [{ ...entry, lastUsed: Date.now() }, ...existing].slice(
    0,
    MAX_RECENT_SESSIONS,
  )
  window.localStorage.setItem(STORAGE_KEYS.recentSessions, JSON.stringify(next))
  return next
}

export function clearRecentSessions(): void {
  if (!storageAvailable) return
  window.localStorage.removeItem(STORAGE_KEYS.recentSessions)
}

/** Убирает одну запись (по паре serverUrl+sessionId) из истории
 *  подключений — используется, когда подключение к этой сессии
 *  завершилось ошибкой, чтобы недоступные ID не копились в списке
 *  "Recent sessions". */
export function removeRecentSession(entry: {
  serverUrl: string
  sessionId: string
}): RecentSession[] {
  if (!storageAvailable) return readRecentSessions()
  const next = readRecentSessions().filter(
    (s) =>
      !(s.serverUrl === entry.serverUrl && s.sessionId === entry.sessionId),
  )
  window.localStorage.setItem(STORAGE_KEYS.recentSessions, JSON.stringify(next))
  return next
}

export const CONNECTION_STORAGE_KEYS = STORAGE_KEYS
