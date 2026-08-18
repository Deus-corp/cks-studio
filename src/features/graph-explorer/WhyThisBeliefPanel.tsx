// Copyright (c) 2026 Deus Corp. Licensed under MIT.

import { useEffect, useMemo, useState } from 'react'
import { IconButton } from '@/components/common/IconButton'
import { useSessionStore } from '@/services/sessionStore'
import type {
  InferencePremiseNode,
  InferenceStepNode,
  SupersededStepNode,
} from '@/shared/types/graph'
import { useGraphStore } from './graphExplorerStore'
import { useArbitrateInferenceConflict } from './useArbitrateInferenceConflict'
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

function StepCard({
  step,
  isTopRanked,
  isStale,
  onRepairStalePremise,
  isRepairing,
}: {
  step: InferenceStepNode
  /** True for the single highest-entrenchment step (see rankByEntrenchment)
   *  -- only meaningful, and only rendered, when there's more than one
   *  active step for this conclusion (see the "Active inference" section
   *  below, which only passes this for a real multi-step ranking). */
  isTopRanked?: boolean
  /** True when a background InferenceStalenessSweeper finding flags this
   *  step as citing a since-superseded premise (CKS-EXT-STALE-PREMISE) --
   *  see useExplainInference's staleStepIds. */
  isStale?: boolean
  onRepairStalePremise?: () => void
  isRepairing?: boolean
}) {
  return (
    <div
      className={`rounded border p-2.5 space-y-1.5 ${
        isTopRanked
          ? 'border-emerald-900/60 bg-emerald-950/10'
          : 'border-border-subtle bg-surface-1'
      }`}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="font-mono text-[11px] text-text-tertiary truncate">
          {step.step_id}
        </span>
        <div className="flex items-center gap-1.5 shrink-0">
          {isTopRanked && (
            <span
              title="Highest confidence among the active steps for this conclusion"
              className="text-[9px] font-display font-semibold uppercase tracking-wider text-emerald-500 bg-emerald-950/40 border border-emerald-900/60 rounded-full px-1.5 py-0.5"
            >
              Most supported
            </span>
          )}
          <span className="text-[10px] font-display font-semibold uppercase tracking-wider text-text-tertiary">
            {formatConfidence(step.confidence)}
          </span>
        </div>
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
      {isStale && (
        <div className="flex items-center justify-between gap-2 rounded border border-yellow-900 bg-yellow-950/30 px-2 py-1">
          <span className="text-[11px] text-yellow-400 leading-snug">
            A cited premise has since been superseded.
          </span>
          {onRepairStalePremise && (
            <button
              type="button"
              onClick={onRepairStalePremise}
              disabled={isRepairing}
              className="shrink-0 text-[10px] font-display font-semibold uppercase tracking-wider text-yellow-400 hover:text-yellow-300 border border-yellow-900 hover:border-yellow-700 rounded px-1.5 py-0.5 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isRepairing ? 'Repairing…' : 'Repair stale premise'}
            </button>
          )}
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

/**
 * Steps ranked highest-entrenchment first: confidence descending, then
 * declared (array) order as a stable tiebreak -- mirrors cks-core's
 * rank_by_entrenchment exactly (see reasoning.py), so the panel's
 * ordering never disagrees with what arbitrate_inference_conflict's
 * 'policy' itself uses to describe "already ordered by entrenchment".
 * explain_knowledge's active_steps already arrive in this order from
 * the backend -- this re-sort is a defensive no-op in the common case,
 * not the panel's only source of ordering.
 */
function rankByEntrenchment(steps: InferenceStepNode[]): InferenceStepNode[] {
  return steps
    .map((step, index) => ({ step, index }))
    .sort((a, b) => {
      const confA = a.step.confidence
      const confB = b.step.confidence
      if (confA === null && confB === null) return a.index - b.index
      if (confA === null) return 1
      if (confB === null) return -1
      if (confA !== confB) return confB - confA
      return a.index - b.index
    })
    .map(({ step }) => step)
}

/**
 * "Resolve conflict" action: shown only when more than one active step
 * concludes the same object_id (data.active_steps.length > 1 is exactly
 * arbitrate_inference_conflict's own "conflict" definition -- see
 * handler.py's `len(active_steps) < 2` check -- so no separate detection
 * call is needed here, unlike stale-premise detection).
 */
function ConflictResolver({
  conclusionId,
  steps,
  onResolve,
  isPending,
  errorMessage,
}: {
  conclusionId: string
  steps: InferenceStepNode[]
  onResolve: (winnerId: string) => void
  isPending: boolean
  errorMessage: string | null
}) {
  const [selectedStepId, setSelectedStepId] = useState<string>(
    steps[0]?.step_id ?? '',
  )

  return (
    <div className="rounded border border-amber-900/60 bg-amber-950/10 p-2.5 space-y-2">
      <div className="text-[10px] font-display font-semibold uppercase tracking-wider text-amber-500">
        Resolve conflict
      </div>
      <p className="text-xs text-text-secondary leading-snug">
        {steps.length} active steps disagree on the confidence for{' '}
        <span className="font-mono text-text-primary">{conclusionId}</span>.
        Pick the step that should remain the accepted conclusion.
      </p>
      <div className="space-y-1.5">
        {steps.map((step) => (
          <label
            key={step.step_id}
            className="flex items-start gap-2 text-xs cursor-pointer"
          >
            <input
              type="radio"
              name={`conflict-winner-${conclusionId}`}
              value={step.step_id}
              checked={selectedStepId === step.step_id}
              onChange={() => setSelectedStepId(step.step_id)}
              className="mt-0.5"
            />
            <span className="min-w-0">
              <span className="font-mono text-text-primary">
                {step.step_id}
              </span>{' '}
              <span className="text-text-tertiary">
                ({formatConfidence(step.confidence)}
                {step.operator ? `, ${step.operator}` : ''})
              </span>
              {step.justification && (
                <span className="block text-text-secondary leading-snug">
                  {step.justification}
                </span>
              )}
            </span>
          </label>
        ))}
      </div>
      {errorMessage && (
        <p className="text-[11px] text-red-400">{errorMessage}</p>
      )}
      <button
        type="button"
        onClick={() => onResolve(selectedStepId)}
        disabled={isPending || !selectedStepId}
        className="w-full text-[10px] font-display font-semibold uppercase tracking-wider text-amber-400 hover:text-amber-300 border border-amber-900 hover:border-amber-700 rounded px-2 py-1.5 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {isPending ? 'Resolving…' : 'Resolve conflict'}
      </button>
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
  const { data, isLoading, error, staleStepIds, refresh } =
    useExplainInference()
  const graphVersion = useGraphStore((s) => s.graphVersion)
  const sessionId = useSessionStore((s) => s.sessionId)
  const {
    status: mutationStatus,
    errorMessage: mutationError,
    resolveConflict,
    repairStalePremise,
    reset: resetMutation,
  } = useArbitrateInferenceConflict(sessionId)
  // step_id currently being repaired, so only that card's button shows
  // "Repairing…" -- repairStalePremise takes an array for API symmetry
  // with the backend's batch-capable stale_premise_ids, but this panel
  // only ever repairs one step at a time (one button per stale card).
  const [repairingStepId, setRepairingStepId] = useState<string | null>(null)

  const rankedActiveSteps = useMemo(
    () => (data ? rankByEntrenchment(data.active_steps) : []),
    [data],
  )

  // Re-fetch whenever the panel is open and the selected node changes,
  // and also whenever the underlying graph data changes (graphVersion,
  // bumped after any committed evolve_knowledge -- see its doc comment
  // in graphExplorerStore) while the panel is already open on the same
  // node. Without the graphVersion dependency, adding an InferenceStep
  // via Quick AI/Chat while "Why this belief?" was already open for
  // that node left the panel showing its stale pre-mutation read.
  // Closing and reopening also re-fetches, since selectedNodeId being
  // unchanged while isOpen flips false->true still re-runs this effect.
  // biome-ignore lint/correctness/useExhaustiveDependencies: graphVersion in the deps array below is an intentional trigger-only dependency (see comment above).
  useEffect(() => {
    if (isOpen) {
      refresh(selectedNodeId)
    }
  }, [isOpen, selectedNodeId, graphVersion, refresh])

  // Clear any leftover mutation status/error from a previous node's
  // conflict/repair action when the selection changes or the panel
  // closes, so e.g. a stale error message doesn't linger under an
  // unrelated node.
  // biome-ignore lint/correctness/useExhaustiveDependencies: resetMutation is stable (useCallback with no changing deps); only isOpen/selectedNodeId should retrigger this.
  useEffect(() => {
    resetMutation()
    setRepairingStepId(null)
  }, [isOpen, selectedNodeId])

  const handleResolveConflict = async (winnerId: string) => {
    if (!selectedNodeId) return
    await resolveConflict(selectedNodeId, winnerId)
  }

  const handleRepairStalePremise = async (stepId: string) => {
    setRepairingStepId(stepId)
    const ok = await repairStalePremise([stepId])
    if (!ok) setRepairingStepId(null)
  }

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
                {mutationStatus === 'success' && (
                  <p className="text-xs text-emerald-400">
                    Applied — refreshing…
                  </p>
                )}

                {rankedActiveSteps.length > 1 && (
                  <ConflictResolver
                    conclusionId={selectedNodeId ?? data.object_id}
                    steps={rankedActiveSteps}
                    onResolve={handleResolveConflict}
                    isPending={mutationStatus === 'pending' && !repairingStepId}
                    errorMessage={!repairingStepId ? mutationError : null}
                  />
                )}

                {rankedActiveSteps.length > 0 && (
                  <div className="space-y-2">
                    <div className="text-[10px] font-display font-semibold uppercase tracking-wider text-text-tertiary">
                      Active inference{' '}
                      {rankedActiveSteps.length > 1
                        ? `(${rankedActiveSteps.length})`
                        : ''}
                    </div>
                    {rankedActiveSteps.map((step, index) => (
                      <StepCard
                        key={step.step_id}
                        step={step}
                        isTopRanked={
                          index === 0 && rankedActiveSteps.length > 1
                        }
                        isStale={staleStepIds.has(step.step_id)}
                        onRepairStalePremise={() =>
                          handleRepairStalePremise(step.step_id)
                        }
                        isRepairing={
                          mutationStatus === 'pending' &&
                          repairingStepId === step.step_id
                        }
                      />
                    ))}
                    {repairingStepId &&
                      mutationStatus === 'error' &&
                      mutationError && (
                        <p className="text-[11px] text-red-400">
                          {mutationError}
                        </p>
                      )}
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
