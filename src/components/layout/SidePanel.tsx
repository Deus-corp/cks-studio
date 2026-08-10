import type { Node } from '@xyflow/react'
import { StatusBadge } from '@/components/common/StatusBadge'
import { ForkDiffPanel } from '@/features/fork-diff/ForkDiffPanel'
import { pipelineStatusColor } from '@/shared/constants/nodeTypes'
import type { ForkVersionData } from '@/shared/types/graph'

export function SidePanel({ node }: { node: Node | null }) {
  if (!node) {
    return (
      <div className="p-4 text-text-secondary text-sm">
        Click a node to inspect it.
      </div>
    )
  }

  const data = node.data as Record<string, unknown>
  const structure = (data.structure as Record<string, unknown>) || {}
  const cksType = data.cksType as string

  // Если это форк — показываем специальную панель
  if (cksType === 'Fork' && structure.versions) {
    return (
      <div className="p-2 text-text-primary">
        <h3 className="text-lg font-semibold mb-2">{data.label as string}</h3>
        <ForkDiffPanel versions={structure.versions as ForkVersionData[]} />
      </div>
    )
  }

  // Если есть transition_log — показываем статус пайплайна
  if (structure.transition_log) {
    const log = structure.transition_log as Array<Record<string, unknown>>
    const currentStatus = (structure.current_status as string) || 'unknown'
    return (
      <div className="p-4 text-text-primary">
        <h3 className="text-lg font-semibold mb-2">{data.label as string}</h3>
        <div className="text-xs text-text-secondary uppercase tracking-wide mb-1">
          {cksType}
        </div>
        <div className="mb-3 flex items-center gap-2">
          <span className="text-sm text-text-secondary">Status:</span>
          <StatusBadge
            status={currentStatus}
            color={pipelineStatusColor(currentStatus)}
          />
        </div>
        <div className="text-sm space-y-2">
          <div className="font-semibold text-text-secondary">Transitions</div>
          {log.map((entry) => {
            const key =
              (entry.content_hash as string) ||
              `${entry.agent}_${entry.action}_${entry.transitioned_to}`
            return (
              <div key={key} className="bg-surface-2 rounded p-2">
                <div className="flex justify-between text-xs text-text-secondary">
                  <span className="text-text-primary">
                    {entry.agent as string}
                  </span>
                  <span className="uppercase text-text-primary">
                    {entry.transitioned_to as string}
                  </span>
                </div>
                <div className="text-text-secondary text-xs mt-1">
                  action:{' '}
                  <span className="text-text-primary">
                    {entry.action as string}
                  </span>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    )
  }

  return (
    <div className="p-4 text-text-primary">
      <h3 className="text-lg font-semibold mb-2">{data.label as string}</h3>
      <div className="text-xs text-text-secondary uppercase tracking-wide mb-1">
        {cksType}
      </div>
      <div className="text-sm space-y-1">
        <div>
          <span className="text-text-secondary">ID:</span>{' '}
          <span className="text-text-primary">{node.id}</span>
        </div>
        <div>
          <span className="text-text-secondary">Type:</span>{' '}
          <span className="text-text-primary">{cksType}</span>
        </div>
        {Object.entries(structure).map(([key, value]) => (
          <div key={key}>
            <span className="text-text-secondary">{key}:</span>{' '}
            <span className="text-text-primary">
              {typeof value === 'string' ? value : JSON.stringify(value)}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}
