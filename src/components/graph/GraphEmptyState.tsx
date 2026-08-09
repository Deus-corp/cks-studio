// Copyright (c) 2025 Deus Corp. Licensed under MIT.

/**
 * Empty-state invitation shown over a blank canvas — before this, an
 * empty graph was just a bare canvas with no cue about what to do next.
 * Per frontend-design guidance, an empty state should read as an
 * invitation to act, not a dead end: it names the two ways to get data
 * on screen (connect to a session, or drag in a subgraph export) instead
 * of just saying "no data".
 *
 * Purely decorative/informational — pointer-events are disabled so it
 * never intercepts canvas drags or clicks.
 */
export function GraphEmptyState() {
  return (
    <div className="absolute inset-0 z-[5] flex items-center justify-center pointer-events-none">
      <div className="max-w-sm text-center px-6">
        <div
          className="mx-auto mb-4 w-14 h-14 rounded-full flex items-center justify-center"
          style={{
            backgroundColor: 'var(--color-surface-1)',
            border: '1px solid var(--color-border-subtle)',
          }}
        >
          <svg
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            aria-hidden="true"
            className="text-accent"
          >
            <circle cx="6" cy="6" r="2.5" fill="currentColor" opacity="0.7" />
            <circle cx="18" cy="8" r="2.5" fill="currentColor" opacity="0.7" />
            <circle cx="10" cy="18" r="2.5" fill="currentColor" opacity="0.7" />
            <line
              x1="6"
              y1="6"
              x2="18"
              y2="8"
              stroke="currentColor"
              strokeWidth="1.4"
              opacity="0.4"
            />
            <line
              x1="6"
              y1="6"
              x2="10"
              y2="18"
              stroke="currentColor"
              strokeWidth="1.4"
              opacity="0.4"
            />
          </svg>
        </div>
        <h2 className="font-display text-sm font-semibold text-text-primary">
          No graph loaded yet
        </h2>
        <p className="mt-1.5 text-xs text-text-secondary leading-relaxed">
          Connect to a session using the fields above, or drag a subgraph{' '}
          <code className="text-text-tertiary">.json</code> export (from{' '}
          <code className="text-text-tertiary">query_subgraph</code>) onto this
          canvas to get started.
        </p>
      </div>
    </div>
  )
}
