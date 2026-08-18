// Copyright (c) 2026 Deus Corp. Licensed under MIT.

import { useCallback, useRef, useState } from 'react'
import { explainKnowledge, listInferenceConflicts } from '@/services/mcpTools'
import { useSessionStore } from '@/services/sessionStore'
import type { ExplainInferenceResult } from '@/shared/types/graph'

interface UseExplainInferenceResult {
  data: ExplainInferenceResult | null
  isLoading: boolean
  error: string | null
  /** step_ids (among data.active_steps) flagged by a background
   *  InferenceStalenessSweeper finding (CKS-EXT-STALE-PREMISE) as
   *  citing a premise that's since been superseded. Best-effort: a
   *  failure fetching this never surfaces as `error` and never blocks
   *  rendering `data` -- see refresh()'s comment below. */
  staleStepIds: Set<string>
  /** Fetch/re-fetch the explanation for `objectId`. No-ops (and clears
   *  any previous result) when there's no session or no objectId --
   *  callers gate this behind panel-open + selectedNodeId already, this
   *  is just a safety net. */
  refresh: (objectId: string | null) => Promise<void>
}

/**
 * Fetches "why is this object believed?" via explain_knowledge's
 * object_id mode (see mcpTools.explainKnowledge / ADR-001). Not
 * auto-triggered on mount or objectId change -- WhyThisBeliefPanel calls
 * refresh() itself from an effect gated on isOpen, so a closed panel
 * never fires a request for a node the user hasn't asked to inspect.
 *
 * Same request-sequence guard as useLLMStatus: refresh() can be called
 * again (a new node selected) before an in-flight request resolves, and
 * the stale response must not clobber the newer one.
 */
export function useExplainInference(): UseExplainInferenceResult {
  const sessionId = useSessionStore((s) => s.sessionId)
  const [data, setData] = useState<ExplainInferenceResult | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [staleStepIds, setStaleStepIds] = useState<Set<string>>(new Set())
  const requestSeq = useRef(0)

  const refresh = useCallback(
    async (objectId: string | null) => {
      const seq = ++requestSeq.current
      if (!objectId || !sessionId.trim()) {
        setData(null)
        setError(null)
        setIsLoading(false)
        setStaleStepIds(new Set())
        return
      }
      setIsLoading(true)
      setError(null)
      try {
        const result = await explainKnowledge(sessionId, objectId)
        if (seq !== requestSeq.current) return
        setData(result)

        // Stale-premise detection needs a second call: explain_knowledge's
        // active_steps carry no "one of my premises was superseded" flag
        // of their own (see WhyThisBeliefPanel design notes) -- that's
        // CKS-EXT-STALE-PREMISE, only visible via the sweeper's queue.
        // Best-effort and peek: true (never drains the queue -- see
        // mcpTools.listInferenceConflicts) so a slow/unavailable sweeper
        // never blocks or errors the panel, it just shows no warnings.
        const activeStepIds = new Set(
          result.active_steps.map((step) => step.step_id),
        )
        if (activeStepIds.size > 0) {
          try {
            const { conflicts } = await listInferenceConflicts({
              sessionId,
              peek: true,
            })
            if (seq !== requestSeq.current) return
            const stale = new Set<string>()
            for (const record of conflicts) {
              for (const diagnostic of record.diagnostics) {
                if (
                  diagnostic.code === 'CKS-EXT-STALE-PREMISE' &&
                  diagnostic.location &&
                  activeStepIds.has(diagnostic.location)
                ) {
                  stale.add(diagnostic.location)
                }
              }
            }
            setStaleStepIds(stale)
          } catch {
            // Supplementary signal only -- explain_knowledge's own result
            // already rendered successfully above, so this stays quiet.
            if (seq === requestSeq.current) setStaleStepIds(new Set())
          }
        } else {
          setStaleStepIds(new Set())
        }
      } catch (e) {
        if (seq !== requestSeq.current) return
        setData(null)
        setError(e instanceof Error ? e.message : 'Unknown error')
        setStaleStepIds(new Set())
      } finally {
        if (seq === requestSeq.current) setIsLoading(false)
      }
    },
    [sessionId],
  )

  return { data, isLoading, error, staleStepIds, refresh }
}
