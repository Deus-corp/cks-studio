// Copyright (c) 2025 Deus Corp. Licensed under MIT.

import { NODE_TYPE_COLORS } from '@/shared/constants/nodeTypes'

/**
 * Статичная легенда цветов узлов по CKS-типу. Данные берутся из
 * NODE_TYPE_COLORS (shared/constants/nodeTypes.ts) — единственного
 * источника правды для этого маппинга, тот же, что использует CksNode.
 */
export function TypeLegend() {
  return (
    <div className="absolute bottom-3 left-3 z-10 bg-gray-900/90 border border-gray-800 rounded-md px-3 py-2 text-xs text-gray-300 space-y-1 pointer-events-none select-none">
      {Object.entries(NODE_TYPE_COLORS).map(([type, color]) => (
        <div key={type} className="flex items-center gap-2">
          <span
            className="w-2.5 h-2.5 rounded-full shrink-0"
            style={{ backgroundColor: color }}
          />
          <span>{type}</span>
        </div>
      ))}
    </div>
  )
}
