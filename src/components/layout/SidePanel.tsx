// Copyright (c) 2025 Deus Corp. Licensed under MIT.

import type { Node } from '@xyflow/react'
import { CollapsibleSection } from '@/components/common/CollapsibleSection'
import { StatusBadge } from '@/components/common/StatusBadge'
import { ForkDiffPanel } from '@/features/fork-diff/ForkDiffPanel'
import { useGraphStore } from '@/features/graph-explorer/graphExplorerStore'
import {
  nodeTypeColor,
  nodeTypeIcon,
  pipelineStatusColor,
} from '@/shared/constants/nodeTypes'
import type { ForkVersionData } from '@/shared/types/graph'
import {
  findInferenceStepsFor,
  findProvenanceFor,
  findReasoningNodesFor,
} from '@/shared/utils/sidePanelUtils'

/** Overview structure fields rendered as raw key/value rows -- everything
 *  else in `structure` that isn't already surfaced by a dedicated field
 *  (name/description/etc above) or claimed by another section
 *  (Pipeline/Agent Findings/Inference/Provenance) below. Keeping this as
 *  an explicit skip-list means Overview never silently swallows a field
 *  another section is already responsible for rendering. */
const STRUCTURE_KEYS_HANDLED_ELSEWHERE = new Set([
  'transition_log',
  'current_status',
  'participants',
  'relation_type',
  'provenance',
  'provenance_id',
  'step_id',
  'operator',
  'confidence',
  'justification',
  'premises',
  'kind',
  'agent',
  'model',
  'object_id',
  'versions',
])

function OverviewSection({ node, cksType }: { node: Node; cksType: string }) {
  const data = node.data as Record<string, unknown>
  const structure = (data.structure as Record<string, unknown>) || {}
  const isRelation =
    cksType === 'Relation' ||
    structure.participants !== undefined ||
    structure.relation_type !== undefined

  const remainingEntries = Object.entries(structure).filter(
    ([key]) => !STRUCTURE_KEYS_HANDLED_ELSEWHERE.has(key),
  )

  return (
    <div className="pb-3 text-sm space-y-1">
      <div className="flex items-center gap-2 mb-1">
        <span
          className="text-base leading-none"
          style={{ color: nodeTypeColor(cksType) }}
          aria-hidden="true"
        >
          {nodeTypeIcon(cksType)}
        </span>
        <span className="text-xs text-text-secondary uppercase tracking-wide">
          {cksType}
        </span>
      </div>
      <h3 className="text-base font-semibold text-text-primary break-words">
        {(data.label as string) || node.id}
      </h3>
      <div>
        <span className="text-text-secondary">ID:</span>{' '}
        <span className="font-mono text-text-primary break-all">{node.id}</span>
      </div>
      {isRelation && (
        <>
          {structure.relation_type !== undefined && (
            <div>
              <span className="text-text-secondary">Relation type:</span>{' '}
              <span className="text-text-primary">
                {String(structure.relation_type)}
              </span>
            </div>
          )}
          {Array.isArray(structure.participants) && (
            <div>
              <span className="text-text-secondary">Participants:</span>{' '}
              <span className="font-mono text-text-primary break-all">
                {(structure.participants as unknown[]).join(', ')}
              </span>
            </div>
          )}
        </>
      )}
      {remainingEntries.map(([key, value]) => (
        <div key={key}>
          <span className="text-text-secondary">{key}:</span>{' '}
          <span className="text-text-primary break-words">
            {typeof value === 'string' ? value : JSON.stringify(value)}
          </span>
        </div>
      ))}
    </div>
  )
}

function PipelineSection({
  structure,
}: {
  structure: Record<string, unknown>
}) {
  const currentStatus = structure.current_status as string | undefined
  const log = (structure.transition_log as Array<Record<string, unknown>>) || []

  return (
    <div className="space-y-2">
      {currentStatus && (
        <div className="flex items-center gap-2">
          <span className="text-sm text-text-secondary">Status:</span>
          <StatusBadge
            status={currentStatus}
            color={pipelineStatusColor(currentStatus)}
          />
        </div>
      )}
      {log.length > 0 && (
        <div className="space-y-2">
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
                {entry.reasoning_node_id !== undefined && (
                  <div className="text-text-secondary text-xs mt-1">
                    reasoning node:{' '}
                    <span className="font-mono text-text-primary">
                      {String(entry.reasoning_node_id)}
                    </span>
                  </div>
                )}
                {entry.timestamp !== undefined && (
                  <div className="text-text-tertiary text-[11px] mt-1">
                    {String(entry.timestamp)}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

function AgentFindingsSection({
  findings,
}: {
  findings: ReturnType<typeof findReasoningNodesFor>
}) {
  return (
    <div className="space-y-2">
      {findings.map((f) => (
        <div key={f.id} className="bg-surface-2 rounded p-2 text-xs space-y-1">
          {f.name && (
            <div className="text-text-primary font-medium">{f.name}</div>
          )}
          <div className="flex flex-wrap gap-x-3 text-text-secondary">
            {f.kind && (
              <span>
                kind: <span className="text-text-primary">{f.kind}</span>
              </span>
            )}
            {f.agent && (
              <span>
                agent: <span className="text-text-primary">{f.agent}</span>
              </span>
            )}
            {f.model && (
              <span>
                model: <span className="text-text-primary">{f.model}</span>
              </span>
            )}
          </div>
          {f.content && (
            <p className="text-text-secondary leading-snug">
              {f.content.length > 160
                ? `${f.content.slice(0, 160)}…`
                : f.content}
            </p>
          )}
          <div className="font-mono text-[10px] text-text-tertiary break-all">
            {f.object_id || f.id}
          </div>
        </div>
      ))}
    </div>
  )
}

function InferenceSection({
  steps,
}: {
  steps: ReturnType<typeof findInferenceStepsFor>
}) {
  if (steps.length === 0) {
    return (
      <p className="text-xs text-text-tertiary">No inference chain found.</p>
    )
  }
  return (
    <div className="space-y-2">
      {steps.map((step) => (
        <div
          key={step.step_id}
          className="rounded border border-border-subtle bg-surface-2 p-2 space-y-1"
        >
          <div className="flex items-center justify-between gap-2 text-xs">
            <span className="font-mono text-text-tertiary truncate">
              {step.step_id}
            </span>
            {step.confidence !== undefined && (
              <span className="text-text-secondary">
                {typeof step.confidence === 'number'
                  ? `${Math.round(step.confidence * 100)}%`
                  : String(step.confidence)}
              </span>
            )}
          </div>
          {step.operator && (
            <div className="text-xs">
              <span className="text-text-secondary">operator:</span>{' '}
              <span className="font-mono text-text-primary">
                {step.operator}
              </span>
            </div>
          )}
          {step.justification && (
            <p className="text-xs text-text-secondary leading-snug">
              {step.justification}
            </p>
          )}
          {step.premises.length > 0 && (
            <div className="flex flex-wrap gap-1 pt-0.5">
              {step.premises.map((premise, idx) => {
                const label =
                  typeof premise === 'string'
                    ? premise
                    : ((premise as Record<string, unknown>)?.object_id as
                        | string
                        | undefined) || JSON.stringify(premise)
                return (
                  <span
                    // biome-ignore lint/suspicious/noArrayIndexKey: premises have no stable id of their own here
                    key={`${step.step_id}-premise-${idx}`}
                    className="inline-flex items-center rounded-full bg-surface-1 border border-border-subtle px-2 py-0.5 text-[11px] text-text-secondary"
                  >
                    {label}
                  </span>
                )
              })}
            </div>
          )}
        </div>
      ))}
    </div>
  )
}

function ProvenanceSection({
  ownProvenance,
  verificationRecords,
}: {
  ownProvenance: unknown
  verificationRecords: Node[]
}) {
  return (
    <div className="space-y-2 text-xs">
      {ownProvenance !== null && ownProvenance !== undefined && (
        <div>
          <span className="text-text-secondary">provenance:</span>{' '}
          <span className="font-mono text-text-primary break-all">
            {typeof ownProvenance === 'string'
              ? ownProvenance
              : JSON.stringify(ownProvenance)}
          </span>
        </div>
      )}
      {verificationRecords.map((rec) => {
        const structure = (rec.data?.structure as Record<string, unknown>) || {}
        const status = structure.status as string | undefined
        return (
          <div key={rec.id} className="bg-surface-2 rounded p-2 space-y-1">
            <div className="font-mono text-[11px] text-text-tertiary break-all">
              {rec.id}
            </div>
            {status && (
              <div>
                <span className="text-text-secondary">status:</span>{' '}
                <span className="text-text-primary">{status}</span>
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

export function SidePanel({ node }: { node: Node | null }) {
  const nodes = useGraphStore((s) => s.nodes)
  const edges = useGraphStore((s) => s.edges)

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

  // Fork nodes get their own dedicated diff panel -- version comparison
  // doesn't fit the section-based layout below.
  if (cksType === 'Fork' && structure.versions) {
    return (
      <div className="p-2 text-text-primary">
        <h3 className="text-lg font-semibold mb-2">{data.label as string}</h3>
        <ForkDiffPanel versions={structure.versions as ForkVersionData[]} />
      </div>
    )
  }

  const hasPipeline =
    structure.current_status !== undefined ||
    structure.transition_log !== undefined
  const reasoningFindings = findReasoningNodesFor(node.id, nodes, edges)
  const inferenceSteps = findInferenceStepsFor(node, nodes, edges)
  const { ownProvenance, verificationRecords } = findProvenanceFor(
    node,
    nodes,
    edges,
  )
  const hasProvenance =
    (ownProvenance !== null && ownProvenance !== undefined) ||
    verificationRecords.length > 0

  return (
    <div className="p-4 text-text-primary">
      {/* Overview is always visible and never collapses -- it's what
       *  agent activity used to push out of view entirely. */}
      <OverviewSection node={node} cksType={cksType} />

      {hasPipeline && (
        <CollapsibleSection title="Pipeline / Transitions" defaultOpen>
          <PipelineSection structure={structure} />
        </CollapsibleSection>
      )}

      {reasoningFindings.length > 0 && (
        <CollapsibleSection title="Agent Findings / Research">
          <AgentFindingsSection findings={reasoningFindings} />
        </CollapsibleSection>
      )}

      {(cksType === 'InferenceStep' || inferenceSteps.length > 0) && (
        <CollapsibleSection title="Inference">
          <InferenceSection steps={inferenceSteps} />
        </CollapsibleSection>
      )}

      {hasProvenance && (
        <CollapsibleSection title="Provenance / Verification">
          <ProvenanceSection
            ownProvenance={ownProvenance}
            verificationRecords={verificationRecords}
          />
        </CollapsibleSection>
      )}
    </div>
  )
}
