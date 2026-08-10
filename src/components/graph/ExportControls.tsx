// Copyright (c) 2025 Deus Corp. Licensed under MIT.

import { Panel, useReactFlow } from '@xyflow/react'
import { useState } from 'react'
import { exportGraphAsPng, exportGraphAsSvg } from '@/shared/utils/graphExport'

/**
 * Кнопки экспорта графа в PNG/SVG.
 *
 * Должен рендериться как child внутри <ReactFlow> (см. GraphCanvas) —
 * useReactFlow() отдаёт актуальный контекст только своим потомкам, а
 * getNodes() из него возвращает узлы с уже измеренными width/height,
 * которые нужны для корректного расчёта границ экспорта (см. graphExport.ts).
 */
export function ExportControls({
  onRefresh,
  isRefreshing,
}: {
  /** Reloads the current session's graph. Refresh button is omitted
   *  entirely if not provided (see GraphCanvas). */
  onRefresh?: () => void
  isRefreshing?: boolean
} = {}) {
  const { getNodes } = useReactFlow()
  const [isExporting, setIsExporting] = useState<'png' | 'svg' | null>(null)
  const [exportError, setExportError] = useState<string | null>(null)

  const handleExport = async (format: 'png' | 'svg') => {
    setExportError(null)
    setIsExporting(format)
    try {
      const nodes = getNodes()
      if (format === 'png') {
        await exportGraphAsPng({ nodes })
      } else {
        await exportGraphAsSvg({ nodes })
      }
    } catch (e) {
      setExportError(e instanceof Error ? e.message : 'Export failed')
    } finally {
      setIsExporting(null)
    }
  }

  return (
    <Panel position="top-right" className="flex flex-col items-end gap-1.5">
      <div className="flex gap-1.5">
        {onRefresh && (
          <button
            type="button"
            onClick={onRefresh}
            disabled={isRefreshing}
            title="Refresh graph"
            aria-label="Refresh graph"
            className="bg-surface-1/90 border border-border hover:bg-surface-2 text-text-secondary hover:text-text-primary w-7 h-7 flex items-center justify-center rounded disabled:opacity-50"
          >
            <span
              className={isRefreshing ? 'inline-block animate-spin' : undefined}
              aria-hidden="true"
            >
              ↻
            </span>
          </button>
        )}
        <button
          type="button"
          onClick={() => handleExport('png')}
          disabled={isExporting !== null}
          className="bg-surface-1/90 border border-border hover:bg-surface-2 text-text-secondary hover:text-text-primary text-xs px-2.5 py-1.5 rounded disabled:opacity-50"
        >
          {isExporting === 'png' ? 'Exporting…' : 'Export PNG'}
        </button>
        <button
          type="button"
          onClick={() => handleExport('svg')}
          disabled={isExporting !== null}
          className="bg-surface-1/90 border border-border hover:bg-surface-2 text-text-secondary hover:text-text-primary text-xs px-2.5 py-1.5 rounded disabled:opacity-50"
        >
          {isExporting === 'svg' ? 'Exporting…' : 'Export SVG'}
        </button>
      </div>
      {exportError && (
        <div className="max-w-xs bg-danger/15 border border-danger/40 text-danger text-xs rounded px-2.5 py-1.5">
          {exportError}
        </div>
      )}
    </Panel>
  )
}
