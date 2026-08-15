// Copyright (c) 2026 Deus Corp. Licensed under MIT.

import { useEffect, useState } from 'react'
import { IconButton } from '@/components/common/IconButton'
import type {
  InferencePremiseNode,
  InferenceStepNode,
  SupersededStepNode,
} from '@/shared/types/graph'
import { useExplainInference } from './useExplainInference'

/** Confidence as a compact percentage; `null` (no confidence recorded on
 *  the step) renders as an em-dash rather than "NaN%". */
function formatConfidence(confidence: number | null): string {
  if (confidence === null || Number.isNaN(confidence)) return '—'
  return `${Math.round(confidence * 100)}%`
}

/** One premise chip. A premise is either a nested sub-explanation (a
 *  base fact, or itself the conclusion of further steps) or a direct
 *  citation of another InferenceStep -- both just need the id and a
 *  short hint here, the full nested chain isn't re-rendered inline to
 *  keep the panel compact (task explicitly calls for premises "as
 *  chips/labels", not a recursive tree). */
function PremiseChip({ premise }: { premise: InferencePremiseNode }) {
  if ('cites_step' in premise) {
    return (
      <span
        title="Cites another inference step directly"
        className="inline-flex items-center gap-1 rounded-full bg-surface-2 border border-border-subtle px-2 py-0.5 text-[11px] text-text-secondary"
      >
        {premise.object_id}
        <span className="text-text-tertiary">↳step</span>
      </span>
    )
  }

  const title =
    premise.truncated === 'cycle'
      ? 'Cycle detected -- chain truncated here'
      : premise.truncated === 'max_depth'
        ? 'Max depth reached -- chain truncated here'
        : premise.has_inference
          ? 'Itself has an inference chain'
          : 'Base fact -- no inference chain'

  return (
    <span
      title={title}
      className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] ${
        premise.truncated
          ? 'bg-yellow-950/30 border-yellow-900 text-yellow-400'
          : 'bg-surface-2 border-border-subtle text-text-secondary'
      }`}
    >
      {premise.object_id}
      {premise.truncated && <span>⋯</span>}
    </span>
  )
}

function StepCard({ step }: { step: InferenceStepNode }) {
  return (
    <div className="rounded border border-border-subtle bg-surface-1 p-2.5 space-y-1.5">
      <div className="flex items-center justify-between gap-2">
        <span className="font-mono text-[11px] text-text-tertiary truncate">
          {step.step_id}
        </span>
        <span className="text-[10px] font-display font-semibold uppercase tracking-wider text-text-tertiary">
          {formatConfidence(step.confidence)}
        </span>
      </div>
      {step.operator && (
        <div className="text-xs">
          <span className="text-text-tertiary">operator:</span>{' '}
          <span className="font-mono text-text-primary">{step.operator}</span>
        </div>
      )}
      {step.justification && (
        <p className="text-xs text-text-secondary leading-snug">
          {step.justification}
        </p>
      )}
      {step.premises.length > 0 && (
        <div className="flex flex-wrap gap-1 pt-0.5">
          {step.premises.map((premise) => (
            <PremiseChip key={premise.object_id} premise={premise} />
          ))}
        </div>
      )}
    </div>
  )
}

function SupersededRow({ step }: { step: SupersededStepNode }) {
  return (
    <div className="rounded border border-border-subtle bg-surface-2/60 px-2.5 py-1.5 text-xs space-y-0.5 opacity-75">
      <div className="flex items-center justify-between gap-2">
        <span className="font-mono text-[11px] text-text-tertiary truncate">
          {step.step_id}
        </span>
        <span className="text-[10px] uppercase tracking-wider text-text-tertiary">
          {formatConfidence(step.confidence)}
        </span>
      </div>
      {step.justification && (
        <p className="text-text-secondary leading-snug">{step.justification}</p>
      )}
      {step.superseded_by && (
        <p className="text-text-tertiary">
          superseded by{' '}
          <span className="font-mono text-text-secondary">
            {step.superseded_by}
          </span>
        </p>
      )}
    </div>
  )
}

export interface WhyThisBeliefPanelProps {
  /** Currently selected node's id (graphExplorerStore.selectedNodeId).
   *  The tab is disabled while this is null. */
  selectedNodeId: string | null
  /** Optional display label for the header -- falls back to the id. */
  selectedNodeLabel?: string | null
}

/**
 * Collapsible "Why this belief?" inspector for the currently selected
 * node -- closed by default, refetches via explain_knowledge whenever
 * it's open and the selection changes (see useExplainInference).
 */
export function WhyThisBeliefPanel({
  selectedNodeId,
  selectedNodeLabel,
}: WhyThisBeliefPanelProps) {
  const [isOpen, setIsOpen] = useState(false)
  const { data, isLoading, error, refresh } = useExplainInference()

  // Re-fetch whenever the panel is open and the selected node changes.
  // Closing and reopening also re-fetches, since selectedNodeId being
  // unchanged while isOpen flips false->true still re-runs this effect.
  useEffect(() => {
    if (isOpen) {
      refresh(selectedNodeId)
    }
  }, [isOpen, selectedNodeId, refresh])

  if (!isOpen) {
    return (
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        disabled={!selectedNodeId}
        aria-expanded={false}
        title={
          selectedNodeId
            ? 'Show why this node is believed'
            : 'Select a node first'
        }
        className="bg-surface-1/95 backdrop-blur-sm border border-border-subtle hover:border-border rounded-md px-3 py-2 text-[10px] font-display font-semibold uppercase tracking-wider text-text-tertiary hover:text-text-secondary shadow-lg transition-colors select-none disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:border-border-subtle"
      >
        {selectedNodeId ? 'Why this belief?' : 'Select a node'}
      </button>
    )
  }

  return (
    <div className="w-[26rem] max-w-[calc(100vw-2rem)] bg-surface-1/95 backdrop-blur-sm border border-border-subtle rounded-md shadow-lg flex flex-col overflow-hidden">
      <div className="flex items-center justify-between gap-2 px-3 py-2 border-b border-border-subtle shrink-0">
        <div className="min-w-0">
          <div className="font-display text-[10px] font-semibold uppercase tracking-wider text-text-tertiary">
            Why this belief?
          </div>
          <div className="font-mono text-xs text-text-primary truncate">
            {selectedNodeLabel || selectedNodeId || '—'}
          </div>
        </div>
        <IconButton
          onClick={() => setIsOpen(false)}
          label="Close panel"
          title="Close"
          size="sm"
          className="!shadow-none !border-transparent !bg-transparent hover:!bg-surface-2 shrink-0"
          icon={<span className="text-xs leading-none">✕</span>}
        />
      </div>

      <div
        className="overflow-y-auto px-3 py-2.5 space-y-3 text-sm"
        style={{ maxHeight: '45vh' }}
      >
        {isLoading && (
          <div className="flex items-center gap-2 text-xs text-text-tertiary py-2">
            <div className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-text-tertiary border-t-transparent" />
            Loading explanation…
          </div>
        )}

        {!isLoading && error && <p className="text-xs text-red-400">{error}</p>}

        {!isLoading && !error && data && (
          <>
            {data.exists === false && (
              <p className="text-xs text-yellow-400">
                This node is not present in the current graph.
              </p>
            )}

            {data.active_steps.length === 0 &&
            data.superseded_steps.length === 0 ? (
              <p className="text-xs text-text-tertiary">
                No inference chain found for this node.
              </p>
            ) : (
              <>
                {data.active_steps.length > 0 && (
                  <div className="space-y-2">
                    <div className="text-[10px] font-display font-semibold uppercase tracking-wider text-text-tertiary">
                      Active inference{' '}
                      {data.active_steps.length > 1
                        ? `(${data.active_steps.length})`
                        : ''}
                    </div>
                    {data.active_steps.map((step) => (
                      <StepCard key={step.step_id} step={step} />
                    ))}
                  </div>
                )}

                {data.superseded_steps.length > 0 && (
                  <div className="space-y-1.5">
                    <div className="text-[10px] font-display font-semibold uppercase tracking-wider text-text-tertiary">
                      Superseded ({data.superseded_steps.length})
                    </div>
                    {data.superseded_steps.map((step) => (
                      <SupersededRow key={step.step_id} step={step} />
                    ))}
                  </div>
                )}
              </>
            )}
          </>
        )}
      </div>
    </div>
  )
}
