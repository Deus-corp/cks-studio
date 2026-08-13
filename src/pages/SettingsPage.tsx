import { useState } from 'react'
import { useLLMStatus } from '@/features/llm-status/useLLMStatus'
import type { LLMStatus } from '@/services/mcpTools'
import { type Theme, useThemeStore } from '@/shared/stores/themeStore'

/** 'auto' isn't a real ThemeState value (the store only ever holds the
 *  resolved 'dark' | 'light', matching data-theme) -- it's a third,
 *  UI-only selector option that re-reads prefers-color-scheme and hands
 *  the resolved value to setTheme, mirroring the demo Settings page and
 *  the store's own initial-load fallback. */
type ThemeChoice = Theme | 'auto'

function resolveAutoTheme(): Theme {
  if (typeof window === 'undefined') return 'dark'
  return window.matchMedia?.('(prefers-color-scheme: light)').matches
    ? 'light'
    : 'dark'
}

export function ThemeToggle() {
  const theme = useThemeStore((s) => s.theme)
  const setTheme = useThemeStore((s) => s.setTheme)
  const [choice, setChoice] = useState<ThemeChoice>(theme)

  const handleSelect = (option: ThemeChoice) => {
    setChoice(option)
    setTheme(option === 'auto' ? resolveAutoTheme() : option)
  }

  return (
    <div className="flex items-center gap-2 bg-surface-2 border border-border-subtle rounded-lg p-1">
      {(['dark', 'light', 'auto'] as const).map((option) => (
        <button
          key={option}
          type="button"
          onClick={() => handleSelect(option)}
          aria-pressed={choice === option}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium capitalize transition-colors ${
            choice === option
              ? 'bg-surface-1 text-text-primary shadow-sm'
              : 'text-text-secondary hover:text-text-primary'
          }`}
        >
          {option === 'dark' ? (
            <svg
              width="13"
              height="13"
              viewBox="0 0 24 24"
              fill="none"
              aria-hidden="true"
            >
              <path
                d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          ) : option === 'light' ? (
            <svg
              width="13"
              height="13"
              viewBox="0 0 24 24"
              fill="none"
              aria-hidden="true"
            >
              <circle
                cx="12"
                cy="12"
                r="4"
                stroke="currentColor"
                strokeWidth="2"
              />
              <path
                d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
              />
            </svg>
          ) : (
            <svg
              width="13"
              height="13"
              viewBox="0 0 24 24"
              fill="none"
              aria-hidden="true"
            >
              <rect
                x="2"
                y="4"
                width="20"
                height="14"
                rx="2"
                stroke="currentColor"
                strokeWidth="2"
              />
              <path
                d="M8 21h8M12 18v3"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
              />
            </svg>
          )}
          {option}
        </button>
      ))}
    </div>
  )
}

function providerLabel(provider: LLMStatus['provider']): string {
  switch (provider) {
    case 'ollama':
      return 'Local Ollama'
    case 'anthropic':
      return 'Anthropic'
    default:
      return 'Not configured'
  }
}

/** "Доступен" здесь значит "именно этот, уже выбранный провайдер сейчас
 *  реально отвечает/настроен" — а не "хоть какой-то провайдер доступен".
 *  Explicit CKS_LLM_PROVIDER на сервере может указывать на провайдер,
 *  который сейчас не поднят (см. get_llm_status/handler.py) — тогда точка
 *  должна быть серой, даже если провайдер "выбран". */
function providerIsUp(status: LLMStatus): boolean {
  if (status.provider === 'ollama') return status.ollama_available
  if (status.provider === 'anthropic') return status.anthropic_configured
  return false
}

/** Блок статуса LLM-провайдера в Settings. Studio — тонкий клиент: сама
 *  никогда не ходит в Ollama/Anthropic и не хранит ANTHROPIC_API_KEY —
 *  только показывает то, что уже решил cks-mcp (get_llm_status). */
function LLMProviderStatus() {
  const { status, isLoading, error, refresh } = useLLMStatus()

  return (
    <div className="mt-6 bg-surface-1 border border-border-subtle rounded-lg p-5">
      <div className="flex items-center justify-between gap-4">
        <p className="text-text-tertiary text-xs uppercase tracking-wide">
          LLM Provider
        </p>
        <button
          type="button"
          onClick={() => refresh()}
          disabled={isLoading}
          className="text-xs text-text-secondary hover:text-text-primary transition-colors disabled:opacity-50"
        >
          {isLoading ? 'Refreshing…' : 'Refresh'}
        </button>
      </div>

      {error && (
        <p className="text-red-400 text-xs mt-3">
          Could not reach cks-mcp: {error}
        </p>
      )}

      {!error && !status && (
        <p className="text-text-secondary text-sm mt-3">Checking…</p>
      )}

      {!error && status && (
        <div className="mt-3">
          <div className="flex items-center gap-2">
            <span
              className={`w-2 h-2 rounded-full inline-block flex-shrink-0 ${
                providerIsUp(status) ? 'bg-green-500' : 'bg-text-tertiary'
              }`}
              title={providerIsUp(status) ? 'available' : 'unavailable'}
            />
            <span className="text-text-primary text-sm font-medium">
              {providerLabel(status.provider)}
            </span>
            {status.model && (
              <span className="text-text-tertiary text-xs font-mono">
                {status.model}
              </span>
            )}
          </div>

          {status.provider === 'none' && (
            <p className="text-text-secondary text-xs mt-2">
              Start Ollama (
              <code className="font-mono">ollama run llama3.2</code>) or set
              ANTHROPIC_API_KEY in{' '}
              <code className="font-mono">~/.cks-mcp/.env</code>.
            </p>
          )}
        </div>
      )}
    </div>
  )
}

export function SettingsPage() {
  return (
    <div className="p-8 max-w-2xl">
      <h1 className="text-lg font-semibold text-text-primary">Settings</h1>
      <p className="text-text-secondary text-sm mt-1">
        MCP server connection settings will be here.
      </p>

      <div className="mt-6 bg-surface-1 border border-border-subtle rounded-lg p-5">
        <p className="text-text-tertiary text-xs uppercase tracking-wide">
          Appearance
        </p>
        <div className="mt-3 flex items-center justify-between gap-4">
          <p className="text-text-secondary text-sm">
            Choose between dark and light theme. Applies immediately and is
            remembered on this device.
          </p>
          <ThemeToggle />
        </div>
      </div>

      <LLMProviderStatus />

      <div className="mt-6 bg-surface-1 border border-border-subtle rounded-lg p-5">
        <p className="text-text-tertiary text-xs uppercase tracking-wide">
          Coming soon
        </p>
        <p className="text-text-secondary text-sm mt-2">
          Server URL and session are currently managed from the{' '}
          <span className="text-text-primary">Graph</span> page's connection
          bar. This page will move that here, plus provider preferences.
        </p>
      </div>
    </div>
  )
}
