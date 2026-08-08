// Copyright (c) 2025 Deus Corp. Licensed under MIT.

import type { CksObject, SubgraphResult } from '@/shared/types/graph'
import {
  ACTIVE_PIPELINE_STATUSES,
  PIPELINE_STATUSES,
  type PipelineObject,
  type PipelineStatus,
} from '@/shared/types/pipeline'

/** Type guard: значение из structure.current_status валидно как PipelineStatus. */
function isPipelineStatus(value: unknown): value is PipelineStatus {
  return (
    typeof value === 'string' &&
    (PIPELINE_STATUSES as readonly string[]).includes(value)
  )
}

/**
 * Достаёт из объектов графа только те, что реально проходят через
 * пайплайн (то есть имеют current_status в structure). Объекты без
 * этого поля (обычные Definition/Claim без Researcher/Reviewer)
 * молча пропускаются — это ожидаемо, не все ноды графа участвуют
 * в pipeline.
 */
export function extractPipelineObjects(objects: CksObject[]): PipelineObject[] {
  const result: PipelineObject[] = []

  for (const obj of objects) {
    const status = obj.structure?.current_status
    if (!isPipelineStatus(status)) continue

    const rawLog = Array.isArray(obj.structure?.transition_log)
      ? (obj.structure?.transition_log as unknown[])
      : []

    result.push({
      id: obj.identity.id,
      name: obj.identity.name,
      type: obj.identity.type,
      current_status: status,
      transition_log: rawLog.filter(
        (entry): entry is PipelineObject['transition_log'][number] =>
          typeof entry === 'object' &&
          entry !== null &&
          'transitioned_to' in entry,
      ),
    })
  }

  return result
}

export function extractPipelineObjectsFromSubgraph(
  subgraph: SubgraphResult,
): PipelineObject[] {
  return extractPipelineObjects(subgraph.nodes)
}

/** Группирует pipeline-объекты по current_status, сохраняя порядок из ACTIVE_PIPELINE_STATUSES. */
export function groupByStatus(
  objects: PipelineObject[],
): Map<PipelineStatus, PipelineObject[]> {
  const grouped = new Map<PipelineStatus, PipelineObject[]>()
  for (const status of ACTIVE_PIPELINE_STATUSES) {
    grouped.set(status, [])
  }
  for (const obj of objects) {
    if (!obj.current_status) continue
    const bucket = grouped.get(obj.current_status)
    if (bucket) {
      bucket.push(obj)
    } else {
      grouped.set(obj.current_status, [obj])
    }
  }
  return grouped
}

/** Сортирует transition_log хронологически (старые записи первыми). */
export function sortTransitionLog(
  log: PipelineObject['transition_log'],
): PipelineObject['transition_log'] {
  return [...log].sort(
    (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime(),
  )
}
