import { Handle, type NodeProps, Position } from '@xyflow/react'
import { memo } from 'react'
import {
  nodeTypeColor,
  nodeTypeIcon,
  pipelineStatusColor,
} from '@/shared/constants/nodeTypes'
import { formatStatusLabel } from '@/shared/utils/formatUtils'

// Degree-based scale, same sqrt-tapered idea as GraphCanvas3D's
// cardScaleForDegree -- a hub node (many incident edges) reads as
// visually more important than a leaf node, but growth is deliberately
// gentle and clamped so a handful of hubs don't blow the 2D layout out
// of proportion the way an unconstrained scale would.
const MIN_SCALE = 0.92
const MAX_SCALE = 1.35
const DEGREE_GROWTH = 0.11

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

function scaleForDegree(degree: number): number {
  return clamp(1 + Math.sqrt(degree) * DEGREE_GROWTH, MIN_SCALE, MAX_SCALE)
}

/**
 * Graph node card. Design intent: a colored border on all four sides
 * reads as "this shape is the color" at a glance but turns into visual
 * noise once a graph has 30+ nodes on screen. A thin top accent bar
 * carries the same type-color signal while letting the card body stay
 * a quiet, neutral surface — the graph's structure (positions, edges)
 * does the work, not a wall of saturated outlines.
 */
function CksNode({ data }: NodeProps) {
  const cksType: string = (data.cksType as string) || 'Concept'
  const color = nodeTypeColor(cksType)
  const icon = nodeTypeIcon(cksType)
  const status = (data.structure as Record<string, unknown>)?.current_status as
    | string
    | undefined
  const statusColor = status ? pipelineStatusColor(status) : undefined
  const isPending = Boolean(data._pending)
  const relationSelectedIndex = data._relationSelectedIndex as
    | number
    | undefined
  const isRelationSelected = relationSelectedIndex !== undefined
  // Populated by useGraphLayout from live edge data -- undefined for any
  // node reached via a path that skips the layout hook (shouldn't
  // normally happen, but degree-based styling should no-op rather than
  // throw if it does).
  const degree = (data.degree as number | undefined) ?? 0
  const scale = scaleForDegree(degree)

  return (
    <div
      className="relative rounded-md text-text-primary transition-shadow"
      title={`${cksType}: ${data.label as string}${degree > 0 ? ` · ${degree} connection${degree === 1 ? '' : 's'}` : ''}`}
      style={{
        minWidth: 172 * scale,
        // surface-3 (not surface-2) — on the light theme surface-2 sits
        // too close to the page background (#f0f1f4 vs #f5f4f0) for the
        // card to read as a distinct shape against the canvas.
        backgroundColor: 'var(--color-surface-3)',
        border: `1px solid ${
          isRelationSelected ? '#f59e0b' : 'var(--color-border-strong)'
        }`,
        borderTop: `${Math.round(3 * scale)}px solid ${isRelationSelected ? '#f59e0b' : color}`,
        borderRadius: '8px',
        opacity: isPending ? 0.65 : 1,
        boxShadow: isRelationSelected
          ? '0 0 0 2px rgba(245, 158, 11, 0.35), 0 6px 16px rgba(0, 0, 0, 0.35)'
          : '0 1px 2px rgba(0, 0, 0, 0.2), 0 8px 20px -8px rgba(0, 0, 0, 0.4)',
      }}
    >
      <Handle type="target" position={Position.Top} />

      {isRelationSelected && (
        <div
          className="absolute -top-2 -left-2 rounded-full w-5 h-5 border flex items-center justify-center text-[10px] font-bold font-mono"
          style={{
            backgroundColor: '#f59e0b',
            color: 'var(--color-surface-0)',
            borderColor: 'var(--color-surface-0)',
          }}
          title={relationSelectedIndex === 0 ? 'Source' : 'Target'}
        >
          {relationSelectedIndex + 1}
        </div>
      )}

      <div
        className="px-3 pt-2.5 pb-3"
        style={{ paddingLeft: 12 * scale, paddingRight: 12 * scale }}
      >
        <div className="flex items-center gap-1.5">
          <span
            className="leading-none opacity-90"
            style={{ fontSize: 11 * scale }}
            aria-hidden="true"
          >
            {icon}
          </span>
          <span
            className="font-display font-semibold uppercase tracking-wider"
            style={{ color, letterSpacing: '0.06em', fontSize: 10 * scale }}
          >
            {cksType}
          </span>
        </div>

        <div
          className="mt-1.5 font-medium leading-snug text-text-primary"
          style={{ fontSize: 13 * scale }}
        >
          {data.label as string}
        </div>

        {isPending && (
          <div className="mt-1 text-[10px] font-mono text-text-tertiary italic">
            saving…
          </div>
        )}
      </div>

      {status && (
        <div
          className="absolute -top-1.5 -right-1.5 rounded-full w-3 h-3 border-2"
          style={{
            backgroundColor: statusColor,
            borderColor: 'var(--color-surface-1)',
          }}
          title={formatStatusLabel(status)}
        />
      )}

      {degree > 0 && (
        <div
          className="absolute -bottom-2 -right-2 rounded-full border flex items-center justify-center font-mono font-semibold leading-none"
          style={{
            minWidth: 18,
            height: 18,
            padding: '0 4px',
            fontSize: 9,
            backgroundColor: 'var(--color-surface-1)',
            borderColor: 'var(--color-border-subtle)',
            color: 'var(--color-text-tertiary)',
          }}
          title={`${degree} connection${degree === 1 ? '' : 's'}`}
        >
          {degree > 99 ? '99+' : degree}
        </div>
      )}

      <Handle type="source" position={Position.Bottom} />
    </div>
  )
}

export default memo(CksNode)
