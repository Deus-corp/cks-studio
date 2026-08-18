// Copyright (c) 2025 Deus Corp. Licensed under MIT.

import { useState } from 'react'
import { useLLMStatus } from '@/features/llm-status/useLLMStatus'
import type { LLMStatus } from '@/services/mcpTools'
import { useSessionStore } from '@/services/sessionStore'
import {
  type LayoutDirection,
  useSettingsStore,
  type ViewMode,
} from '@/shared/stores/settingsStore'
import { type ThemeMode, useThemeStore } from '@/shared/stores/themeStore'

type ThemeChoice = ThemeMode

export function ThemeToggle() {
  // Read `mode` (what the user picked, incl. 'auto') rather than the
  // resolved `theme`, so the toggle shows "Auto" as selected instead of
  // whichever concrete theme 'auto' currently resolves to. Reading here
  // is purely a subscription -- it never calls setTheme itself, so
  // mounting this component (e.g. by navigating to Settings) cannot
  // change the active theme on its own.
  const mode = useThemeStore((s) => s.mode)
  const setTheme = useThemeStore((s) => s.setTheme)
  const setSettingsTheme = useSettingsStore((s) => s.setTheme)
  const [choice, setChoice] = useState<ThemeChoice>(mode)

  const handleSelect = (option: ThemeChoice) => {
    setChoice(option)
    setTheme(option)
    // Mirror into settingsStore too so Settings 2.0 has a single place to
    // read "what the user picked" for display purposes elsewhere.
    setSettingsTheme(option)
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
    case 'openai_compatible':
      return 'OpenAI-compatible'
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
  if (status.provider === 'openai_compatible')
    return status.openai_compatible_configured
  return false
}

/** Блок статуса LLM-провайдера в Settings. Studio — тонкий клиент: сама
 *  никогда не ходит в Ollama/Anthropic и не хранит ANTHROPIC_API_KEY —
 *  только показывает то, что уже решил cks-mcp (get_llm_status). */
function LLMProviderStatus() {
  const { status, isLoading, error, refresh } = useLLMStatus()

  return (
    <Card>
      <div className="flex items-center justify-between gap-4">
        <SectionLabel>LLM Provider</SectionLabel>
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
    </Card>
  )
}

// ---------------------------------------------------------------------
// Small shared building blocks for the new sectioned layout.
// ---------------------------------------------------------------------

function Card({ children }: { children: React.ReactNode }) {
  return (
    <div className="mt-4 bg-surface-1 border border-border-subtle rounded-lg p-5">
      {children}
    </div>
  )
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-text-tertiary text-xs uppercase tracking-wide">
      {children}
    </p>
  )
}

function Row({
  label,
  description,
  control,
}: {
  label: string
  description?: string
  control: React.ReactNode
}) {
  return (
    <div className="flex items-center justify-between gap-4 py-2">
      <div>
        <p className="text-text-primary text-sm">{label}</p>
        {description && (
          <p className="text-text-secondary text-xs mt-0.5">{description}</p>
        )}
      </div>
      <div className="flex-shrink-0">{control}</div>
    </div>
  )
}

function Toggle({
  checked,
  onChange,
  label,
}: {
  checked: boolean
  onChange: (value: boolean) => void
  label: string
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
        checked ? 'bg-accent' : 'bg-surface-2 border border-border-subtle'
      }`}
    >
      <span
        className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${
          checked ? 'translate-x-4' : 'translate-x-1'
        }`}
      />
    </button>
  )
}

function SegmentedControl<T extends string>({
  value,
  options,
  onChange,
}: {
  value: T
  options: readonly { value: T; label: string }[]
  onChange: (value: T) => void
}) {
  return (
    <div className="flex items-center gap-1 bg-surface-2 border border-border-subtle rounded-lg p-1">
      {options.map((opt) => (
        <button
          key={opt.value}
          type="button"
          onClick={() => onChange(opt.value)}
          aria-pressed={value === opt.value}
          className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${
            value === opt.value
              ? 'bg-surface-1 text-text-primary shadow-sm'
              : 'text-text-secondary hover:text-text-primary'
          }`}
        >
          {opt.label}
        </button>
      ))}
    </div>
  )
}

function CopySnippet({ label, code }: { label: string; code: string }) {
  const [copied, setCopied] = useState(false)

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(code)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {
      // Clipboard API can be unavailable (older browsers, insecure
      // context, permission denied) -- fail silently, the snippet is
      // still visible to select/copy manually.
    }
  }

  return (
    <div className="mt-2">
      <div className="flex items-center justify-between gap-2">
        <p className="text-text-secondary text-xs">{label}</p>
        <button
          type="button"
          onClick={handleCopy}
          className="text-xs text-text-secondary hover:text-text-primary transition-colors"
        >
          {copied ? 'Copied!' : 'Copy'}
        </button>
      </div>
      <pre className="mt-1 bg-surface-2 border border-border-subtle rounded-md px-3 py-2 text-xs font-mono text-text-primary overflow-x-auto">
        {code}
      </pre>
    </div>
  )
}

// ---------------------------------------------------------------------
// Sections
// ---------------------------------------------------------------------

const VIEW_MODE_OPTIONS = [
  { value: '2d' as ViewMode, label: '2D' },
  { value: '3d' as ViewMode, label: '3D' },
]

const LAYOUT_DIRECTION_OPTIONS = [
  { value: 'TB' as LayoutDirection, label: 'Top-down' },
  { value: 'LR' as LayoutDirection, label: 'Left-right' },
]

function AppearanceSection() {
  const settings = useSettingsStore()

  return (
    <div>
      <Card>
        <SectionLabel>Theme</SectionLabel>
        <div className="mt-3 flex items-center justify-between gap-4">
          <p className="text-text-secondary text-sm">
            Choose between dark and light theme. Applies immediately and is
            remembered on this device.
          </p>
          <ThemeToggle />
        </div>
      </Card>

      <Card>
        <SectionLabel>Graph Defaults</SectionLabel>
        <Row
          label="Default view mode"
          description="Which view GraphPage opens in, until you switch it manually."
          control={
            <SegmentedControl
              value={settings.defaultViewMode}
              options={VIEW_MODE_OPTIONS}
              onChange={settings.setDefaultViewMode}
            />
          }
        />
        <Row
          label="Default layout direction"
          description="Dagre layout direction for the 2D graph."
          control={
            <SegmentedControl
              value={settings.defaultLayoutDirection}
              options={LAYOUT_DIRECTION_OPTIONS}
              onChange={settings.setDefaultLayoutDirection}
            />
          }
        />
      </Card>

      <Card>
        <SectionLabel>Canvas Overlays</SectionLabel>
        <Row
          label="Show minimap"
          control={
            <Toggle
              checked={settings.showMiniMap}
              onChange={settings.setShowMiniMap}
              label="Show minimap"
            />
          }
        />
        <Row
          label="Show type legend"
          control={
            <Toggle
              checked={settings.showTypeLegend}
              onChange={settings.setShowTypeLegend}
              label="Show type legend"
            />
          }
        />
        <Row
          label="Show edge labels"
          control={
            <Toggle
              checked={settings.showEdgeLabels}
              onChange={settings.setShowEdgeLabels}
              label="Show edge labels"
            />
          }
        />
      </Card>
    </div>
  )
}

function ConnectionSection() {
  const settings = useSettingsStore()
  const session = useSessionStore()
  const [testResult, setTestResult] = useState<
    'idle' | 'testing' | 'ok' | 'error'
  >('idle')

  const handleTestConnection = async () => {
    setTestResult('testing')
    try {
      const res = await fetch(`${settings.mcpServerUrl}/health`).catch(() =>
        fetch(settings.mcpServerUrl),
      )
      setTestResult(res.ok ? 'ok' : 'error')
    } catch {
      setTestResult('error')
    }
  }

  return (
    <div>
      <Card>
        <SectionLabel>MCP Server</SectionLabel>
        <div className="mt-3 flex items-center gap-2">
          <input
            type="text"
            value={settings.mcpServerUrl}
            onChange={(e) => settings.setMcpServerUrl(e.target.value)}
            placeholder="http://127.0.0.1:8765"
            className="flex-1 bg-surface-2 border border-border-subtle rounded-md px-3 py-1.5 text-sm text-text-primary font-mono"
          />
          <button
            type="button"
            onClick={handleTestConnection}
            disabled={testResult === 'testing'}
            className="px-3 py-1.5 rounded-md text-xs font-medium bg-surface-2 border border-border-subtle text-text-secondary hover:text-text-primary transition-colors disabled:opacity-50"
          >
            {testResult === 'testing' ? 'Testing…' : 'Test Connection'}
          </button>
        </div>
        {testResult === 'ok' && (
          <p className="text-green-500 text-xs mt-2">Server reachable.</p>
        )}
        {testResult === 'error' && (
          <p className="text-red-400 text-xs mt-2">
            Could not reach {settings.mcpServerUrl}.
          </p>
        )}
        <p className="text-text-tertiary text-xs mt-2">
          This is the default used when the studio starts. The Graph page's
          connection bar (current session: {session.sessionId || '—'}) can still
          override it per-session.
        </p>
      </Card>

      <Card>
        <SectionLabel>Recent Sessions</SectionLabel>
        {session.recentSessions.length === 0 ? (
          <p className="text-text-secondary text-sm mt-3">
            No recent sessions yet.
          </p>
        ) : (
          <ul className="mt-3 space-y-1.5">
            {session.recentSessions.map((rs) => (
              <li
                key={`${rs.serverUrl}::${rs.sessionId}`}
                className="text-xs font-mono text-text-secondary flex items-center justify-between gap-2"
              >
                <span className="truncate">
                  {rs.sessionId}{' '}
                  <span className="text-text-tertiary">@ {rs.serverUrl}</span>
                </span>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card>
        <SectionLabel>Live Updates</SectionLabel>
        <Row
          label="Auto-reconnect to live events (SSE)"
          description="Keeps the graph in sync automatically as the session changes."
          control={
            <Toggle
              checked={settings.autoReconnectSse}
              onChange={settings.setAutoReconnectSse}
              label="Auto-reconnect to live events"
            />
          }
        />
        <Row
          label="SSE refresh debounce"
          description="Milliseconds to coalesce rapid live-event bursts before refreshing."
          control={
            <input
              type="number"
              min={0}
              step={50}
              value={settings.sseRefreshDebounceMs}
              onChange={(e) =>
                settings.setSseRefreshDebounceMs(Number(e.target.value) || 0)
              }
              className="w-24 bg-surface-2 border border-border-subtle rounded-md px-2 py-1 text-sm text-text-primary text-right font-mono"
            />
          }
        />
      </Card>
    </div>
  )
}

const SETUP_SNIPPETS = {
  ollama: 'ollama run llama3.2',
  anthropic: 'echo "ANTHROPIC_API_KEY=sk-ant-..." >> ~/.cks-mcp/.env',
  // OpenAI-compatible providers (OpenRouter, vLLM, LM Studio, etc.) need
  // all four of these -- provider selection, base URL, key, and model --
  // set server-side. Kept as separate copyable snippets (rather than one
  // multi-line blob) so a user can grab just the one they still need to
  // change, e.g. only CKS_OPENAI_MODEL when swapping models on the same
  // OpenRouter account.
  openaiCompatibleProvider:
    'echo "CKS_LLM_PROVIDER=openai_compatible" >> ~/.cks-mcp/.env',
  openaiCompatibleBaseUrl:
    'echo "CKS_OPENAI_BASE_URL=https://openrouter.ai/api/v1" >> ~/.cks-mcp/.env',
  openaiCompatibleApiKey: 'echo "CKS_OPENAI_API_KEY=sk-..." >> ~/.cks-mcp/.env',
  openaiCompatibleModel:
    'echo "CKS_OPENAI_MODEL=nvidia/nemotron-3-super-120b-a12b:free" >> ~/.cks-mcp/.env',
  httpServer: 'CKS_MCP_HTTP_PORT=8765 cks-mcp',
}

function AiLlmSection() {
  const settings = useSettingsStore()

  return (
    <div>
      <LLMProviderStatus />

      <Card>
        <SectionLabel>Preferences</SectionLabel>
        <p className="text-text-secondary text-xs mt-2">
          These are local hints for the studio UI only — the server always
          decides which provider is actually active (see LLM Provider above).
        </p>
        <Row
          label="Preferred provider"
          control={
            <select
              value={settings.provider ?? ''}
              onChange={(e) =>
                settings.setProvider(
                  (e.target.value || null) as typeof settings.provider,
                )
              }
              className="bg-surface-2 border border-border-subtle rounded-md px-2 py-1 text-sm text-text-primary"
            >
              <option value="">Auto (server-decided)</option>
              <option value="ollama">Ollama</option>
              <option value="anthropic">Anthropic</option>
              <option value="openai_compatible">OpenAI-compatible</option>
            </select>
          }
        />
        <Row
          label="Model"
          description="Leave blank to use the server's default model."
          control={
            <input
              type="text"
              aria-label="Model"
              value={settings.selectedModel ?? ''}
              onChange={(e) =>
                settings.setSelectedModel(e.target.value || null)
              }
              className="w-64 bg-surface-2 border border-border-subtle rounded-md px-2 py-1 text-sm text-text-primary font-mono"
            />
          }
        />
        <Row
          label="Open Quick AI panel by default"
          control={
            <Toggle
              checked={settings.quickAiPanelDefaultOpen}
              onChange={settings.setQuickAiPanelDefaultOpen}
              label="Open Quick AI panel by default"
            />
          }
        />
      </Card>

      <Card>
        <SectionLabel>Server Setup (informational)</SectionLabel>
        <p className="text-text-secondary text-xs mt-2">
          API keys must live on the server that runs cks-mcp — Studio is a
          browser app and can never securely hold or set{' '}
          <code className="font-mono">CKS_OPENAI_API_KEY</code> (or any other
          provider key) itself. The snippets below are for that machine's shell/
          <code className="font-mono">~/.cks-mcp/.env</code>, then restart
          cks-mcp for them to take effect.
        </p>
        <CopySnippet label="Ollama" code={SETUP_SNIPPETS.ollama} />
        <CopySnippet label="Anthropic" code={SETUP_SNIPPETS.anthropic} />
        <p className="text-text-tertiary text-xs mt-4">
          OpenAI-compatible (OpenRouter, vLLM, LM Studio, etc.) — needs all
          four:
        </p>
        <CopySnippet
          label="CKS_LLM_PROVIDER"
          code={SETUP_SNIPPETS.openaiCompatibleProvider}
        />
        <CopySnippet
          label="CKS_OPENAI_BASE_URL"
          code={SETUP_SNIPPETS.openaiCompatibleBaseUrl}
        />
        <CopySnippet
          label="CKS_OPENAI_API_KEY"
          code={SETUP_SNIPPETS.openaiCompatibleApiKey}
        />
        <CopySnippet
          label="CKS_OPENAI_MODEL"
          code={SETUP_SNIPPETS.openaiCompatibleModel}
        />
        <CopySnippet
          label="HTTP server port"
          code={SETUP_SNIPPETS.httpServer}
        />
      </Card>
    </div>
  )
}

function GraphBehaviorSection() {
  const settings = useSettingsStore()

  return (
    <div>
      <Card>
        <SectionLabel>Focus Mode</SectionLabel>
        <Row
          label="Enabled by default (2D)"
          control={
            <Toggle
              checked={settings.focusModeEnabledByDefault2D}
              onChange={settings.setFocusModeEnabledByDefault2D}
              label="Focus mode enabled by default in 2D"
            />
          }
        />
        <Row
          label="Enabled by default (3D)"
          control={
            <Toggle
              checked={settings.focusModeEnabledByDefault3D}
              onChange={settings.setFocusModeEnabledByDefault3D}
              label="Focus mode enabled by default in 3D"
            />
          }
        />
      </Card>

      <Card>
        <SectionLabel>Node Sizing</SectionLabel>
        <Row
          label="Degree-based node sizing"
          description="Size nodes by how many connections they have."
          control={
            <Toggle
              checked={settings.degreeBasedSizingEnabled}
              onChange={settings.setDegreeBasedSizingEnabled}
              label="Degree-based node sizing"
            />
          }
        />
      </Card>

      <Card>
        <SectionLabel>Polling</SectionLabel>
        <Row
          label="Agent / process / dead-letter poll interval"
          description="How often panels re-check for updates, in milliseconds."
          control={
            <input
              type="number"
              min={1000}
              step={1000}
              value={settings.pollingIntervalMs}
              onChange={(e) =>
                settings.setPollingIntervalMs(Number(e.target.value) || 1000)
              }
              className="w-24 bg-surface-2 border border-border-subtle rounded-md px-2 py-1 text-sm text-text-primary text-right font-mono"
            />
          }
        />
      </Card>
    </div>
  )
}

function AboutSection() {
  return (
    <div>
      <Card>
        <SectionLabel>Server</SectionLabel>
        <p className="text-text-secondary text-sm mt-2">
          cks-mcp exposes 64 tools across Knowledge Structure management, graph
          reasoning agents, and conflict resolution. Component versions and live
          tool counts are visible per-graph via the Graph Explorer's "About this
          graph" panel.
        </p>
      </Card>

      <Card>
        <SectionLabel>Links</SectionLabel>
        <ul className="mt-2 space-y-1 text-sm">
          <li>
            <a
              href="https://github.com/Deus-corp/cks-mcp"
              target="_blank"
              rel="noreferrer"
              className="text-accent hover:underline"
            >
              cks-mcp on GitHub
            </a>
          </li>
          <li>
            <a
              href="https://github.com/Deus-corp/cks-studio"
              target="_blank"
              rel="noreferrer"
              className="text-accent hover:underline"
            >
              cks-studio on GitHub
            </a>
          </li>
          <li>
            <a
              href="https://github.com/Deus-corp/cks-core"
              target="_blank"
              rel="noreferrer"
              className="text-accent hover:underline"
            >
              cks-core on GitHub
            </a>
          </li>
        </ul>
      </Card>

      <Card>
        <SectionLabel>Built with</SectionLabel>
        <p className="text-text-secondary text-sm mt-2">
          The 2D graph view is powered by{' '}
          <a
            href="https://reactflow.dev"
            target="_blank"
            rel="noreferrer"
            className="text-accent hover:underline"
          >
            React Flow
          </a>{' '}
          by xyflow.
        </p>
      </Card>
    </div>
  )
}

function DangerZoneSection() {
  const resetAllSettings = useSettingsStore((s) => s.resetAllSettings)
  const setThemeState = useThemeStore((s) => s.setTheme)
  const clearRecentSessions = useSessionStore((s) => s.reset)
  const [confirming, setConfirming] = useState(false)

  const handleReset = () => {
    if (!confirming) {
      setConfirming(true)
      return
    }
    resetAllSettings()
    setThemeState('dark')
    clearRecentSessions()
    setConfirming(false)
  }

  return (
    <div>
      <Card>
        <SectionLabel>Reset</SectionLabel>
        <p className="text-text-secondary text-sm mt-2">
          Clears all locally stored studio preferences (appearance, connection
          defaults, AI preferences, graph behavior) and resets the theme to
          dark. This does not affect anything on the cks-mcp server.
        </p>
        <button
          type="button"
          onClick={handleReset}
          className={`mt-3 px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
            confirming
              ? 'bg-red-500 text-white hover:bg-red-600'
              : 'bg-surface-2 border border-border-subtle text-text-secondary hover:text-text-primary'
          }`}
        >
          {confirming ? 'Click again to confirm reset' : 'Reset all settings'}
        </button>
      </Card>
    </div>
  )
}

// ---------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------

type SettingsTab =
  | 'appearance'
  | 'connection'
  | 'ai'
  | 'graph'
  | 'about'
  | 'danger'

const TABS: { id: SettingsTab; label: string }[] = [
  { id: 'appearance', label: 'Appearance' },
  { id: 'connection', label: 'Connection' },
  { id: 'ai', label: 'AI & LLM' },
  { id: 'graph', label: 'Graph Behavior' },
  { id: 'about', label: 'About' },
  { id: 'danger', label: 'Danger Zone' },
]

export function SettingsPage() {
  const [activeTab, setActiveTab] = useState<SettingsTab>('appearance')

  return (
    <div className="p-8 max-w-4xl">
      <h1 className="text-lg font-semibold text-text-primary">Settings</h1>
      <p className="text-text-secondary text-sm mt-1">
        Preferences are stored locally in this browser and applied immediately
        where possible.
      </p>

      <div className="mt-6 flex gap-6">
        <nav className="w-44 flex-shrink-0">
          <ul className="space-y-1">
            {TABS.map((tab) => (
              <li key={tab.id}>
                <button
                  type="button"
                  onClick={() => setActiveTab(tab.id)}
                  aria-current={activeTab === tab.id}
                  className={`w-full text-left px-3 py-1.5 rounded-md text-sm transition-colors ${
                    activeTab === tab.id
                      ? 'bg-surface-2 text-text-primary font-medium'
                      : 'text-text-secondary hover:text-text-primary hover:bg-surface-2/50'
                  }`}
                >
                  {tab.label}
                </button>
              </li>
            ))}
          </ul>
        </nav>

        <div className="flex-1 min-w-0">
          {activeTab === 'appearance' && <AppearanceSection />}
          {activeTab === 'connection' && <ConnectionSection />}
          {activeTab === 'ai' && <AiLlmSection />}
          {activeTab === 'graph' && <GraphBehaviorSection />}
          {activeTab === 'about' && <AboutSection />}
          {activeTab === 'danger' && <DangerZoneSection />}
        </div>
      </div>
    </div>
  )
}
