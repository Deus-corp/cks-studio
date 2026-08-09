// Copyright (c) 2025 Deus Corp. Licensed under MIT.

import type { Edge, Node } from '@xyflow/react'
import { useCallback, useState } from 'react'
import { useGraphStore } from '@/features/graph-explorer/graphExplorerStore'
import { evolveKnowledge } from '@/services/mcpTools'
import type { EvolveDiagnostic, EvolveOperation } from '@/shared/types/graph'
import { isEvolveError } from '@/shared/types/graph'

export type EvolveMutationStatus = 'idle' | 'pending' | 'error'

interface EvolveMutationState {
  status: EvolveMutationStatus
  /** Читаемое сообщение об отказе, не относящееся к конкретному полю
   *  (например transport-ошибка или error === 'invalid_operations'). */
  errorMessage: string | null
  /** diagnostics с validation_failed — по одному на строку в форме. */
  diagnostics: EvolveDiagnostic[]
  /** non-blocking diagnostics из УСПЕШНОГО коммита (warning/info) —
   *  отдельно от errorMessage/diagnostics, чтобы форма не путала их
   *  с отказом. */
  warnings: EvolveDiagnostic[]
}

const initialState: EvolveMutationState = {
  status: 'idle',
  errorMessage: null,
  diagnostics: [],
  warnings: [],
}

/**
 * Мутация для одиночной evolve_knowledge-операции (add_object /
 * add_relation) с optimistic update графа и откатом при ошибке.
 *
 * Optimistic-узел/ребро — необязательные параметры run(): если переданы,
 * они добавляются в стор немедленно с data._pending=true, коммитятся при
 * успехе или удаляются при ошибке/сетевом сбое. Без них run() просто ждёт
 * ответа сервера (полезно, если вызывающий код сам управляет UI, например
 * при добавлении узла + связи в одной операции последовательно).
 */
export function useEvolveMutation(sessionId: string) {
  const [state, setState] = useState<EvolveMutationState>(initialState)
  const addPendingNode = useGraphStore((s) => s.addPendingNode)
  const commitPendingNode = useGraphStore((s) => s.commitPendingNode)
  const rollbackPendingNode = useGraphStore((s) => s.rollbackPendingNode)
  const addPendingEdge = useGraphStore((s) => s.addPendingEdge)
  const commitPendingEdge = useGraphStore((s) => s.commitPendingEdge)
  const rollbackPendingEdge = useGraphStore((s) => s.rollbackPendingEdge)

  const reset = useCallback(() => setState(initialState), [])

  const run = useCallback(
    async (
      operation: EvolveOperation,
      optimistic?: { node?: Node; edge?: Edge },
    ): Promise<boolean> => {
      if (!sessionId.trim()) {
        setState({
          ...initialState,
          status: 'error',
          errorMessage: 'No active session — connect to a session first.',
        })
        return false
      }

      if (optimistic?.node) addPendingNode(optimistic.node)
      if (optimistic?.edge) addPendingEdge(optimistic.edge)

      setState({ ...initialState, status: 'pending' })

      const rollback = () => {
        if (optimistic?.node) rollbackPendingNode(optimistic.node.id)
        if (optimistic?.edge) rollbackPendingEdge(optimistic.edge.id)
      }

      try {
        const result = await evolveKnowledge(sessionId, [operation])

        if (isEvolveError(result)) {
          rollback()
          setState({
            status: 'error',
            errorMessage: result.message ?? result.error,
            // validation_failed puts field-level diagnostics either in
            // 'diagnostics' or, for provenance rejections, in 'details' —
            // see EvolveError comments in shared/types/graph.ts.
            diagnostics: result.diagnostics ?? result.details ?? [],
            warnings: [],
          })
          return false
        }

        if (optimistic?.node) commitPendingNode(optimistic.node.id)
        if (optimistic?.edge) commitPendingEdge(optimistic.edge.id)
        setState({
          status: 'idle',
          errorMessage: null,
          diagnostics: [],
          warnings: result.diagnostics ?? [],
        })
        return true
      } catch (e) {
        // Только транспортные/сетевые сбои долетают сюда — см. комментарий
        // в mcpTools.ts::evolveKnowledge про то, почему бизнес-ошибки
        // evolve_knowledge не бросают исключение.
        rollback()
        setState({
          status: 'error',
          errorMessage: e instanceof Error ? e.message : 'Network error',
          diagnostics: [],
          warnings: [],
        })
        return false
      }
    },
    [
      sessionId,
      addPendingNode,
      commitPendingNode,
      rollbackPendingNode,
      addPendingEdge,
      commitPendingEdge,
      rollbackPendingEdge,
    ],
  )

  return { ...state, run, reset }
}
