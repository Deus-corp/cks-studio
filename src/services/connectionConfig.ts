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
} as const

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

export const CONNECTION_STORAGE_KEYS = STORAGE_KEYS
