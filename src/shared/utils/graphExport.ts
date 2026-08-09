// Copyright (c) 2025 Deus Corp. Licensed under MIT.

import type { Node } from '@xyflow/react'
import { getNodesBounds, getViewportForBounds } from '@xyflow/react'
import { toPng, toSvg } from 'html-to-image'

/**
 * Экспортирует текущий граф в PNG/SVG.
 *
 * Стандартный паттерн React Flow: вместо скриншота видимого viewport'а
 * (который обрезал бы граф при текущем зуме/пане) считаем bounding box
 * ВСЕХ узлов и временно выставляем transform на `.react-flow__viewport`,
 * чтобы в кадр попал весь граф целиком, затем растеризуем этот DOM-узел
 * через html-to-image.
 *
 * `nodes` должны быть получены через useReactFlow().getNodes() (а не
 * взяты напрямую из zustand-стора) — только они содержат измеренные
 * width/height после рендера, которые нужны getNodesBounds для точного
 * расчёта границ. Узлы из стора до рендера имеют position {x:0,y:0} и
 * не содержат размеров.
 */

const EXPORT_PADDING = 0.1
const MIN_ZOOM = 0.1
const MAX_ZOOM = 2

interface ExportOptions {
  nodes: Node[]
  width?: number
  height?: number
  backgroundColor?: string
  fileName?: string
}

function getViewportElement(): HTMLElement {
  const el = document.querySelector('.react-flow__viewport')
  if (!el) {
    throw new Error(
      'react-flow__viewport not found in DOM — граф ещё не отрендерен?',
    )
  }
  return el as HTMLElement
}

async function withFramedViewport<T>(
  { nodes, width = 1600, height = 1200 }: ExportOptions,
  render: (viewportEl: HTMLElement) => Promise<T>,
): Promise<T> {
  if (nodes.length === 0) {
    throw new Error('Граф пуст — нечего экспортировать.')
  }

  const viewportEl = getViewportElement()
  const bounds = getNodesBounds(nodes)
  const transform = getViewportForBounds(
    bounds,
    width,
    height,
    MIN_ZOOM,
    MAX_ZOOM,
    EXPORT_PADDING,
  )

  const previousTransform = viewportEl.style.transform
  const previousWidth = viewportEl.style.width
  const previousHeight = viewportEl.style.height

  viewportEl.style.width = `${width}px`
  viewportEl.style.height = `${height}px`
  viewportEl.style.transform = `translate(${transform.x}px, ${transform.y}px) scale(${transform.zoom})`

  try {
    return await render(viewportEl)
  } finally {
    // Возвращаем реальный viewport в исходное состояние — иначе canvas
    // "залипнет" на кадре экспорта после того, как скачивание завершится.
    viewportEl.style.transform = previousTransform
    viewportEl.style.width = previousWidth
    viewportEl.style.height = previousHeight
  }
}

function downloadDataUrl(dataUrl: string, fileName: string): void {
  const link = document.createElement('a')
  link.download = fileName
  link.href = dataUrl
  link.click()
}

export async function exportGraphAsPng(options: ExportOptions): Promise<void> {
  const { width = 1600, height = 1200, backgroundColor = '#111827' } = options
  const dataUrl = await withFramedViewport(options, (viewportEl) =>
    toPng(viewportEl, {
      backgroundColor,
      width,
      height,
      pixelRatio: 2,
    }),
  )
  downloadDataUrl(dataUrl, options.fileName ?? 'cks-graph.png')
}

export async function exportGraphAsSvg(options: ExportOptions): Promise<void> {
  const { width = 1600, height = 1200, backgroundColor = '#111827' } = options
  const dataUrl = await withFramedViewport(options, (viewportEl) =>
    toSvg(viewportEl, {
      backgroundColor,
      width,
      height,
    }),
  )
  downloadDataUrl(dataUrl, options.fileName ?? 'cks-graph.svg')
}
