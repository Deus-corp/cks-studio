// Copyright (c) 2025 Deus Corp. Licensed under MIT.

import { NODE_TYPE_COLORS, nodeTypeIcon } from '@/shared/constants/nodeTypes'
import { withAlpha } from '@/shared/utils/colorUtils'

/**
 * Статичная легенда цветов узлов по CKS-типу. Данные берутся из
 * NODE_TYPE_COLORS (shared/constants/nodeTypes.ts) — единственного
 * источника правды для этого маппинга, тот же, что использует CksNode.
 */
export function TypeLegend() {
  return (
    <div className="absolute bottom-3 left-3 z-10 bg-surface-1/95 backdrop-blur-sm border border-border-subtle rounded-md px-3 py-2 text-xs text-text-secondary space-y-1.5 pointer-events-none select-none shadow-lg">
      {Object.entries(NODE_TYPE_COLORS).map(([type, color]) => (
        <div key={type} className="flex items-center gap-2">
          <span
            className="w-2 h-2 rounded-full shrink-0"
            style={{
              backgroundColor: color,
              boxShadow: `0 0 0 3px ${withAlpha(color, 0.18)}`,
            }}
          />
          <span aria-hidden="true" className="text-[10px] leading-none">
            {nodeTypeIcon(type)}
          </span>
          <span className="font-display text-[11px] font-medium tracking-wide text-text-primary">
            {type}
          </span>
        </div>
      ))}
    </div>
  )
}
