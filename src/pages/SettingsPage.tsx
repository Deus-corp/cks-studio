export function SettingsPage() {
  return (
    <div className="p-8 max-w-2xl">
      <h1 className="text-lg font-semibold text-text-primary">Settings</h1>
      <p className="text-text-secondary text-sm mt-1">
        MCP server connection settings will be here.
      </p>

      <div className="mt-6 bg-surface-1 border border-border-subtle rounded-lg p-5">
        <p className="text-text-tertiary text-xs uppercase tracking-wide">
          Coming soon
        </p>
        <p className="text-text-secondary text-sm mt-2">
          Server URL and session are currently managed from the{' '}
          <span className="text-text-primary">Graph</span> page's connection
          bar. This page will move that here, plus theme and provider
          preferences.
        </p>
      </div>
    </div>
  )
}
