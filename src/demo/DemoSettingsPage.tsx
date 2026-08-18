// Copyright (c) 2026 Deus Corp. Licensed under MIT.

import { useState } from 'react'
import { listComponentVersions } from '@/services/mockClient'
import { type ThemeMode, useThemeStore } from '@/shared/stores/themeStore'

const OLLAMA_SNIPPET =
  'CKS_LLM_PROVIDER=ollama CKS_OLLAMA_HOST=http://localhost:11434 npm run mcp'

type ThemeChoice = ThemeMode

function ThemeSelector() {
  const mode = useThemeStore((s) => s.mode)
  const setTheme = useThemeStore((s) => s.setTheme)
  const [choice, setChoice] = useState<ThemeChoice>(mode)

  const options: { value: ThemeChoice; label: string }[] = [
    { value: 'light', label: 'Light' },
    { value: 'dark', label: 'Dark' },
    { value: 'auto', label: 'Auto' },
  ]

  const handleSelect = (value: ThemeChoice) => {
    setChoice(value)
    setTheme(value)
  }

  return (
    <div className="flex items-center gap-2 bg-surface-2 border border-border-subtle rounded-lg p-1">
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          onClick={() => handleSelect(option.value)}
          aria-pressed={choice === option.value}
          className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
            choice === option.value
              ? 'bg-surface-1 text-text-primary shadow-sm'
              : 'text-text-secondary hover:text-text-primary'
          }`}
        >
          {option.label}
        </button>
      ))}
    </div>
  )
}

function ComponentVersions() {
  const versions = listComponentVersions()

  return (
    <div className="mt-6 bg-surface-1 border border-border-subtle rounded-lg p-5">
      <p className="text-text-tertiary text-xs uppercase tracking-wide">
        Component Versions
      </p>
      <p className="text-text-secondary text-xs mt-1">
        Read from the bundled cks-ecosystem graph shown on the Graph tab.
      </p>
      <div className="mt-3 divide-y divide-border-subtle">
        {versions.map((component) => (
          <div
            key={component.id}
            className="flex items-center justify-between gap-4 py-2"
          >
            <div className="min-w-0">
              <p className="text-sm text-text-primary font-medium truncate">
                {component.name}
              </p>
              {component.description && (
                <p className="text-xs text-text-tertiary truncate">
                  {component.description}
                </p>
              )}
            </div>
            <span className="text-xs font-mono text-text-secondary bg-surface-2 px-2 py-0.5 rounded flex-shrink-0">
              {component.version}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}

function CopyOllamaSetup() {
  const [copied, setCopied] = useState(false)

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(OLLAMA_SNIPPET)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // Clipboard access can fail (permissions, insecure context) --
      // the button just stays in its normal state rather than throwing.
    }
  }

  return (
    <div className="mt-6 bg-surface-1 border border-border-subtle rounded-lg p-5">
      <p className="text-text-tertiary text-xs uppercase tracking-wide">
        Run with a local LLM
      </p>
      <p className="text-text-secondary text-sm mt-2">
        Point cks-mcp at a local Ollama instance instead of Anthropic's API.
      </p>
      <div className="mt-3 flex items-center gap-2">
        <code className="flex-1 text-xs font-mono text-text-secondary bg-surface-2 border border-border-subtle rounded px-3 py-2 overflow-x-auto whitespace-nowrap">
          {OLLAMA_SNIPPET}
        </code>
        <button
          type="button"
          onClick={handleCopy}
          className="text-xs bg-surface-2 hover:bg-surface-3 text-text-primary px-3 py-2 rounded flex-shrink-0 flex items-center gap-1.5"
        >
          {copied ? (
            <>
              <svg
                width="12"
                height="12"
                viewBox="0 0 24 24"
                fill="none"
                aria-hidden="true"
              >
                <path
                  d="M20 6L9 17l-5-5"
                  stroke="currentColor"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
              Copied
            </>
          ) : (
            'Copy Ollama setup'
          )}
        </button>
      </div>
    </div>
  )
}

/**
 * Static demo variant of SettingsPage: keeps the real, working theme
 * selector (backed by the same themeStore the whole demo shares) plus two
 * pieces that need no server at all -- component versions read straight
 * from the bundled ecosystem graph, and a copyable local-LLM setup
 * snippet. The LLM Provider status block from the real page is dropped
 * here since it depends on a live get_llm_status call.
 */
export function DemoSettingsPage() {
  return (
    <div className="p-8 max-w-2xl">
      <h1 className="text-lg font-semibold text-text-primary">Settings</h1>
      <p className="text-text-secondary text-sm mt-1">
        Static demo — server connection and LLM provider status need a live
        cks-mcp server.
      </p>

      <div className="mt-6 bg-surface-1 border border-border-subtle rounded-lg p-5">
        <p className="text-text-tertiary text-xs uppercase tracking-wide">
          Appearance
        </p>
        <div className="mt-3 flex items-center justify-between gap-4">
          <p className="text-text-secondary text-sm">
            Choose a theme. Applies immediately and is remembered on this
            device.
          </p>
          <ThemeSelector />
        </div>
      </div>

      <ComponentVersions />
      <CopyOllamaSetup />
    </div>
  )
}
