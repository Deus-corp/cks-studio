import { useThemeStore } from '@/shared/stores/themeStore'

function ThemeToggle() {
  const theme = useThemeStore((s) => s.theme)
  const setTheme = useThemeStore((s) => s.setTheme)

  return (
    <div className="flex items-center gap-2 bg-surface-2 border border-border-subtle rounded-lg p-1">
      {(['dark', 'light'] as const).map((option) => (
        <button
          key={option}
          type="button"
          onClick={() => setTheme(option)}
          aria-pressed={theme === option}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium capitalize transition-colors ${
            theme === option
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
          ) : (
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
          )}
          {option}
        </button>
      ))}
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
