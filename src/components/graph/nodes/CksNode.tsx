import { Handle, type NodeProps, Position } from '@xyflow/react'
import { memo } from 'react'
import {
  nodeTypeColor,
  nodeTypeIcon,
  pipelineStatusColor,
} from '@/shared/constants/nodeTypes'
import { formatStatusLabel } from '@/shared/utils/formatUtils'

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

  return (
    <div
      className="relative rounded-md text-text-primary transition-shadow"
      style={{
        minWidth: 172,
        backgroundColor: 'var(--color-surface-2)',
        border: `1px solid ${
          isRelationSelected ? '#f59e0b' : 'var(--color-border)'
        }`,
        borderTop: `3px solid ${isRelationSelected ? '#f59e0b' : color}`,
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

      <div className="px-3 pt-2.5 pb-3">
        <div className="flex items-center gap-1.5">
          <span
            className="text-[11px] leading-none opacity-90"
            aria-hidden="true"
          >
            {icon}
          </span>
          <span
            className="font-display font-semibold text-[10px] uppercase tracking-wider"
            style={{ color, letterSpacing: '0.06em' }}
          >
            {cksType}
          </span>
        </div>

        <div className="mt-1.5 text-[13px] font-medium leading-snug text-text-primary">
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

      <Handle type="source" position={Position.Bottom} />
    </div>
  )
}

export default memo(CksNode)
