// Copyright (c) 2025 Deus Corp. Licensed under MIT.

import { exportGraphAsPng, exportGraphAsSvg } from '@/shared/utils/graphExport'
import { Panel, useReactFlow } from '@xyflow/react'
import { useState } from 'react'

/**
 * Кнопки экспорта графа в PNG/SVG.
 *
 * Должен рендериться как child внутри <ReactFlow> (см. GraphCanvas) —
 * useReactFlow() отдаёт актуальный контекст только своим потомкам, а
 * getNodes() из него возвращает узлы с уже измеренными width/height,
 * которые нужны для корректного расчёта границ экспорта (см. graphExport.ts).
 */
export function ExportControls() {
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
        <button
          type="button"
          onClick={() => handleExport('png')}
          disabled={isExporting !== null}
          className="bg-gray-900/90 border border-gray-700 hover:bg-gray-800 text-gray-200 text-xs px-2.5 py-1.5 rounded disabled:opacity-50"
        >
          {isExporting === 'png' ? 'Exporting…' : 'Export PNG'}
        </button>
        <button
          type="button"
          onClick={() => handleExport('svg')}
          disabled={isExporting !== null}
          className="bg-gray-900/90 border border-gray-700 hover:bg-gray-800 text-gray-200 text-xs px-2.5 py-1.5 rounded disabled:opacity-50"
        >
          {isExporting === 'svg' ? 'Exporting…' : 'Export SVG'}
        </button>
      </div>
      {exportError && (
        <div className="max-w-xs bg-red-900/90 border border-red-700 text-red-100 text-xs rounded px-2.5 py-1.5">
          {exportError}
        </div>
      )}
    </Panel>
  )
}
