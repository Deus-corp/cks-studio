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

  return (
    <div
      className="rounded-lg border-2 px-3 py-2 shadow-lg text-gray-100 relative"
      style={{
        borderColor: color,
        backgroundColor: withAlpha(color, 0.125),
        minWidth: 160,
      }}
    >
      <Handle type="target" position={Position.Top} />
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
