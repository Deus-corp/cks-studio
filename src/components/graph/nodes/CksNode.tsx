import {
  nodeTypeColor,
  nodeTypeIcon,
  pipelineStatusColor,
} from '@/shared/constants/nodeTypes'
import { withAlpha } from '@/shared/utils/colorUtils'
import { formatStatusLabel } from '@/shared/utils/formatUtils'
import { Handle, type NodeProps, Position } from '@xyflow/react'
import { memo } from 'react'

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

  return (
    <div
      className="rounded-lg border-2 px-3 py-2 shadow-lg text-gray-100 relative"
      style={{
        borderColor: relationSelectedIndex !== undefined ? '#f59e0b' : color,
        borderStyle: isPending ? 'dashed' : 'solid',
        opacity: isPending ? 0.7 : 1,
        backgroundColor: withAlpha(color, 0.125),
        minWidth: 160,
        boxShadow:
          relationSelectedIndex !== undefined
            ? '0 0 0 2px rgba(245, 158, 11, 0.5)'
            : undefined,
      }}
    >
      <Handle type="target" position={Position.Top} />
      {relationSelectedIndex !== undefined && (
        <div
          className="absolute -top-2 -left-2 rounded-full w-5 h-5 border border-gray-900 bg-amber-500 text-gray-900 text-[10px] font-bold flex items-center justify-center"
          title={relationSelectedIndex === 0 ? 'Source' : 'Target'}
        >
          {relationSelectedIndex + 1}
        </div>
      )}
      <div className="flex items-center gap-2">
        <span className="text-sm">{icon}</span>
        <span
          className="font-semibold text-xs uppercase tracking-wide"
          style={{ color }}
        >
          {cksType}
        </span>
      </div>
      <div className="mt-1 text-sm font-medium truncate">
        {data.label as string}
      </div>
      {isPending && (
        <div className="mt-1 text-[10px] text-gray-400 italic">saving…</div>
      )}
      {status && (
        <div
          className="absolute -top-2 -right-2 rounded-full w-3 h-3 border border-gray-900"
          style={{ backgroundColor: statusColor }}
          title={formatStatusLabel(status)}
        />
      )}
      <Handle type="source" position={Position.Bottom} />
    </div>
  )
}

export default memo(CksNode)
