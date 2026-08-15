// Copyright (c) 2025 Deus Corp. Licensed under MIT.

import { Panel, useReactFlow } from '@xyflow/react'
import { useState } from 'react'
import { IconButton } from '@/components/common/IconButton'
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
  panelRef,
}: {
  /** Reloads the current session's graph. Refresh button is omitted
   *  entirely if not provided (see GraphCanvas). */
  onRefresh?: () => void
  isRefreshing?: boolean
  /** Forwarded to the underlying <Panel>'s DOM node -- lets GraphCanvas
   *  measure this panel's actual rendered height/position (see the
   *  Focus-button centering effect there) instead of guessing a pixel
   *  offset for the Focus toggle stacked below it, which is what made
   *  that offset go stale every time this row's contents changed. */
  panelRef?: React.Ref<HTMLDivElement>
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
    <Panel
      ref={panelRef}
      position="top-right"
      className="flex flex-col items-end gap-1.5"
    >
      <div className="flex gap-1.5">
        {onRefresh && (
          <IconButton
            onClick={onRefresh}
            disabled={isRefreshing}
            label="Refresh graph"
            icon={
              <span
                className={
                  isRefreshing ? 'inline-block animate-spin' : undefined
                }
              >
                ↻
              </span>
            }
          />
        )}
        <IconButton
          onClick={() => handleExport('png')}
          disabled={isExporting !== null}
          label={isExporting === 'png' ? 'Exporting PNG…' : 'Export as PNG'}
          icon={
            isExporting === 'png' ? (
              <span className="inline-block animate-spin text-xs">↻</span>
            ) : (
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                aria-hidden="true"
              >
                <rect
                  x="3"
                  y="3"
                  width="18"
                  height="18"
                  rx="2"
                  stroke="currentColor"
                  strokeWidth="2"
                />
                <circle cx="8.5" cy="8.5" r="1.5" fill="currentColor" />
                <path
                  d="M21 15l-5-5L5 21"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            )
          }
        />
        <IconButton
          onClick={() => handleExport('svg')}
          disabled={isExporting !== null}
          label={isExporting === 'svg' ? 'Exporting SVG…' : 'Export as SVG'}
          icon={
            isExporting === 'svg' ? (
              <span className="inline-block animate-spin text-xs">↻</span>
            ) : (
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                aria-hidden="true"
              >
                <path
                  d="M4 16l4-8 4 8M6.5 10.5h3M14 16V8h3a2 2 0 010 4h-3M4 16h4M14 12h3"
                  stroke="currentColor"
                  strokeWidth="1.6"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            )
          }
        />
      </div>
      {exportError && (
        <div className="max-w-xs bg-danger/15 border border-danger/40 text-danger text-xs rounded px-2.5 py-1.5">
          {exportError}
        </div>
      )}
    </Panel>
  )
}
