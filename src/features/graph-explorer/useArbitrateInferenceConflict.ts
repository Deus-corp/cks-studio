// Copyright (c) 2026 Deus Corp. Licensed under MIT.

import { useCallback, useState } from 'react'
import { useGraphStore } from '@/features/graph-explorer/graphExplorerStore'
import { arbitrateInferenceConflict } from '@/services/mcpTools'
import { isArbitrateConflictError, isEvolveError } from '@/shared/types/graph'

export type ArbitrateMutationStatus = 'idle' | 'pending' | 'error' | 'success'

interface ArbitrateMutationState {
  status: ArbitrateMutationStatus
  errorMessage: string | null
}

const initialState: ArbitrateMutationState = {
  status: 'idle',
  errorMessage: null,
}

/**
 * Belief-revision write actions for WhyThisBeliefPanel, both funnelled
 * through arbitrate_inference_conflict (see mcpTools.arbitrateInferenceConflict
 * for why one wrapper covers both request shapes):
 *
 * - resolveConflict: apply a caller-picked winner_id for a disputed
 *   conclusion (CKS-EXT-INFERENCE-CONFIDENCE-CONFLICT).
 * - repairStalePremise: mechanically repoint one or more steps' stale
 *   premise citations at their live successor (CKS-EXT-STALE-PREMISE).
 *
 * Both always pass commit: true -- this hook is for the panel's "apply
 * it now" actions, not for surfacing active_steps/policy for read-only
 * inspection (WhyThisBeliefPanel gets that from useExplainInference's
 * own data instead, so it never has to call arbitrate_inference_conflict
 * itself just to look).
 *
 * On success, bumps graphVersion the same way useEvolveMutation does --
 * WhyThisBeliefPanel's own refresh effect is already keyed on
 * graphVersion, so the panel re-fetches (and updated staleStepIds are
 * recomputed) without this hook calling refresh() directly.
 */
export function useArbitrateInferenceConflict(sessionId: string) {
  const [state, setState] = useState<ArbitrateMutationState>(initialState)
  const bumpGraphVersion = useGraphStore((s) => s.bumpGraphVersion)

  const reset = useCallback(() => setState(initialState), [])

  const resolveConflict = useCallback(
    async (
      conclusionId: string,
      winnerId: string,
      reasoning?: string,
    ): Promise<boolean> => {
      if (!sessionId.trim()) {
        setState({
          status: 'error',
          errorMessage: 'No active session — connect to a session first.',
        })
        return false
      }
      setState({ status: 'pending', errorMessage: null })
      try {
        const result = await arbitrateInferenceConflict({
          sessionId,
          conclusionId,
          winnerId,
          reasoning,
          commit: true,
        })
        if (isArbitrateConflictError(result)) {
          setState({
            status: 'error',
            errorMessage: result.message ?? result.error,
          })
          return false
        }
        if (result.commit_result && isEvolveError(result.commit_result)) {
          setState({
            status: 'error',
            errorMessage:
              result.commit_result.message ?? result.commit_result.error,
          })
          return false
        }
        bumpGraphVersion()
        setState({ status: 'success', errorMessage: null })
        return true
      } catch (e) {
        setState({
          status: 'error',
          errorMessage: e instanceof Error ? e.message : 'Network error',
        })
        return false
      }
    },
    [sessionId, bumpGraphVersion],
  )

  const repairStalePremise = useCallback(
    async (stepIds: string[]): Promise<boolean> => {
      if (!sessionId.trim()) {
        setState({
          status: 'error',
          errorMessage: 'No active session — connect to a session first.',
        })
        return false
      }
      setState({ status: 'pending', errorMessage: null })
      try {
        const result = await arbitrateInferenceConflict({
          sessionId,
          stalePremiseIds: stepIds,
          commit: true,
        })
        if (isArbitrateConflictError(result)) {
          setState({
            status: 'error',
            errorMessage: result.message ?? result.error,
          })
          return false
        }
        if (result.commit_result && isEvolveError(result.commit_result)) {
          setState({
            status: 'error',
            errorMessage:
              result.commit_result.message ?? result.commit_result.error,
          })
          return false
        }
        bumpGraphVersion()
        setState({ status: 'success', errorMessage: null })
        return true
      } catch (e) {
        setState({
          status: 'error',
          errorMessage: e instanceof Error ? e.message : 'Network error',
        })
        return false
      }
    },
    [sessionId, bumpGraphVersion],
  )

  return { ...state, resolveConflict, repairStalePremise, reset }
}
