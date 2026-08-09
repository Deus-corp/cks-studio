// Copyright (c) 2025 Deus Corp. Licensed under MIT.

/**
 * Skeleton placeholder shown while a session's graph is loading, instead
 * of an instant pop-in once fitView finishes. A handful of pulsing
 * "node card" rectangles connected by faint lines, loosely arranged like
 * a real dagre layout, so the transition into the real graph doesn't
 * feel like a layout jump.
 */
const SKELETON_NODES = [
  { x: 90, y: 40, w: 130, h: 44 },
  { x: 320, y: 30, w: 150, h: 44 },
  { x: 40, y: 160, w: 140, h: 44 },
  { x: 260, y: 180, w: 130, h: 44 },
  { x: 460, y: 150, w: 150, h: 44 },
  { x: 180, y: 290, w: 140, h: 44 },
]

const SKELETON_EDGES: Array<[number, number]> = [
  [0, 1],
  [0, 2],
  [1, 3],
  [3, 4],
  [2, 5],
  [3, 5],
]

export function GraphSkeleton() {
  return (
    <div
      className="absolute inset-0 z-[6] flex items-center justify-center"
      style={{ backgroundColor: 'var(--color-surface-0)' }}
      role="status"
      aria-label="Loading graph"
    >
      <svg
        viewBox="0 0 620 380"
        className="w-full h-full max-w-2xl opacity-90"
        aria-hidden="true"
      >
        {SKELETON_EDGES.map(([a, b]) => {
          const na = SKELETON_NODES[a]
          const nb = SKELETON_NODES[b]
          return (
            <line
              key={`${a}-${b}`}
              x1={na.x + na.w / 2}
              y1={na.y + na.h / 2}
              x2={nb.x + nb.w / 2}
              y2={nb.y + nb.h / 2}
              stroke="var(--color-border)"
              strokeWidth="1.5"
              className="animate-pulse"
            />
          )
        })}
        {SKELETON_NODES.map((n, i) => (
          <rect
            key={`${n.x}-${n.y}`}
            x={n.x}
            y={n.y}
            width={n.w}
            height={n.h}
            rx="8"
            fill="var(--color-surface-2)"
            stroke="var(--color-border-subtle)"
            className="animate-pulse"
            style={{ animationDelay: `${i * 80}ms` }}
          />
        ))}
      </svg>
    </div>
  )
}
