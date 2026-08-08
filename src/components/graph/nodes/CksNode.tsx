import { memo } from 'react'
import { Handle, Position, type NodeProps } from '@xyflow/react'

const TYPE_COLORS: Record<string, string> = {
  Definition: '#3b82f6',
  Claim: '#8b5cf6',
  Concept: '#10b981',
  Fork: '#f59e0b',
  Resolution: '#06b6d4',
}

const TYPE_ICONS: Record<string, string> = {
  Definition: '📖',
  Claim: '💬',
  Concept: '💡',
  Fork: '⑂',
  Resolution: '✓',
}

const STATUS_COLORS: Record<string, string> = {
  awaiting_research: '#6b7280',
  awaiting_review: '#3b82f6',
  needs_research: '#ef4444',
  resolved: '#10b981',
}

function CksNode({ data }: NodeProps) {
  const cksType: string = (data.cksType as string) || 'Concept'
  const color = TYPE_COLORS[cksType] || '#6b7280'
  const icon = TYPE_ICONS[cksType] || '?'
  const status = (data.structure as Record<string, unknown>)?.current_status as string | undefined
  const statusColor = status ? STATUS_COLORS[status] || '#6b7280' : undefined

  return (
    <div
      className="rounded-lg border-2 px-3 py-2 shadow-lg text-gray-100 relative"
      style={{ borderColor: color, backgroundColor: `${color}20`, minWidth: 160 }}
    >
      <Handle type="target" position={Position.Top} />
      <div className="flex items-center gap-2">
        <span className="text-sm">{icon}</span>
        <span className="font-semibold text-xs uppercase tracking-wide" style={{ color }}>
          {cksType}
        </span>
      </div>
      <div className="mt-1 text-sm font-medium truncate">{data.label as string}</div>
      {status && (
        <div
          className="absolute -top-2 -right-2 rounded-full w-3 h-3 border border-gray-900"
          style={{ backgroundColor: statusColor }}
          title={status.replace(/_/g, ' ')}
        />
      )}
      <Handle type="source" position={Position.Bottom} />
    </div>
  )
}

export default memo(CksNode)