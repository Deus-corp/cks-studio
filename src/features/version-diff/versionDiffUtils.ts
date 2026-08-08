// Copyright (c) 2025 Deus Corp. Licensed under MIT.

import type { ExplainDiffResult, VersionEntry } from '@/shared/types/graph'

/** Сортирует версии от новых к старым по created_at (list_versions
 *  не гарантирует порядок, см. handler.py — просто итерирует history). */
export function sortVersionsDesc(versions: VersionEntry[]): VersionEntry[] {
  return [...versions].sort(
    (a, b) =>
      new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
  )
}

export interface DiffCounts {
  addedObjects: number
  removedObjects: number
  modifiedObjects: number
  addedRelations: number
  removedRelations: number
  modifiedRelations: number
  renamedObjects: number
  totalChanges: number
}

/** Суммарные счётчики по всем секциям explain_diff.details — для бейджей
 *  в UI и для решения "показывать ли 'No changes detected'". */
export function countDiffChanges(
  details: ExplainDiffResult['details'],
): DiffCounts {
  const addedObjects = details.added_objects.length
  const removedObjects = details.removed_objects.length
  const modifiedObjects = details.modified_objects.length
  const addedRelations = details.added_relations.length
  const removedRelations = details.removed_relations.length
  const modifiedRelations = details.modified_relations.length
  const renamedObjects = details.renamed_objects.length

  return {
    addedObjects,
    removedObjects,
    modifiedObjects,
    addedRelations,
    removedRelations,
    modifiedRelations,
    renamedObjects,
    totalChanges:
      addedObjects +
      removedObjects +
      modifiedObjects +
      addedRelations +
      removedRelations +
      modifiedRelations +
      renamedObjects,
  }
}

/** Человекочитаемое представление значения поля для отображения в
 *  diff-строке (from/to) — примитивы как есть, остальное через JSON.stringify,
 *  undefined/null сводятся к em-dash. */
export function formatDiffValue(value: unknown): string {
  if (value === undefined || value === null) return '—'
  if (typeof value === 'string') return value
  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value)
  }
  try {
    return JSON.stringify(value)
  } catch {
    return String(value)
  }
}
