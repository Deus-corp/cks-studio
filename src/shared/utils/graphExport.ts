// Copyright (c) 2025 Deus Corp. Licensed under MIT.

import type { Node } from '@xyflow/react'
import { getNodesBounds, getViewportForBounds } from '@xyflow/react'

// html-to-image is only needed when the user actually triggers a PNG/SVG
// export, but GraphPage (which imports exportGraphAsPng/exportGraphAsSvg
// transitively) is mounted for the entire lifetime of the app -- see
// App.tsx's AppContent comment. A static import here would put the whole
// library in the main entry chunk for every visit, even sessions that
// never export anything. Dynamic-importing it inside each export
// function (cached by the browser/bundler after the first call) keeps
// it in its own chunk, loaded only on first actual export click.

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
const PIXEL_RATIO = 3

// Floor for the export canvas so small graphs (a handful of nodes)
// don't produce a tiny, blurry-when-upscaled image.
const MIN_EXPORT_WIDTH = 1600
const MIN_EXPORT_HEIGHT = 1200
// Bounding-box padding in graph units, added on each side before we
// convert the bounds into a pixel canvas size below. This is separate
// from EXPORT_PADDING (which pads the *viewport transform*, i.e. the
// zoom-to-fit math) -- this one pads the raw canvas dimensions so large
// graphs (>200 nodes) get proportionally more room instead of being
// squeezed into a fixed 1600x1200 frame.
const BOUNDS_PADDING = 100

interface ExportOptions {
  nodes: Node[]
  width?: number
  height?: number
  backgroundColor?: string
  fileName?: string
}

/**
 * Canvas size for the export: an explicit width/height always wins: caller-set,
 * otherwise derived from the node bounding box (plus BOUNDS_PADDING) so
 * large graphs get a canvas big enough to stay legible, with a floor at
 * MIN_EXPORT_WIDTH/HEIGHT so small graphs don't export a tiny image.
 */
function computeExportSize(
  nodes: Node[],
  explicitWidth?: number,
  explicitHeight?: number,
): { width: number; height: number } {
  if (explicitWidth !== undefined && explicitHeight !== undefined) {
    return { width: explicitWidth, height: explicitHeight }
  }
  const bounds = getNodesBounds(nodes)
  const boundsWidth = bounds.width + BOUNDS_PADDING * 2
  const boundsHeight = bounds.height + BOUNDS_PADDING * 2
  return {
    width: explicitWidth ?? Math.max(MIN_EXPORT_WIDTH, Math.round(boundsWidth)),
    height:
      explicitHeight ?? Math.max(MIN_EXPORT_HEIGHT, Math.round(boundsHeight)),
  }
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
  { nodes, width, height }: ExportOptions,
  render: (
    viewportEl: HTMLElement,
    width: number,
    height: number,
  ) => Promise<T>,
): Promise<T> {
  if (nodes.length === 0) {
    throw new Error('Граф пуст — нечего экспортировать.')
  }

  const viewportEl = getViewportElement()
  const bounds = getNodesBounds(nodes)
  const { width: exportWidth, height: exportHeight } = computeExportSize(
    nodes,
    width,
    height,
  )
  const transform = getViewportForBounds(
    bounds,
    exportWidth,
    exportHeight,
    MIN_ZOOM,
    MAX_ZOOM,
    EXPORT_PADDING,
  )

  const previousTransform = viewportEl.style.transform
  const previousWidth = viewportEl.style.width
  const previousHeight = viewportEl.style.height

  viewportEl.style.width = `${exportWidth}px`
  viewportEl.style.height = `${exportHeight}px`
  viewportEl.style.transform = `translate(${transform.x}px, ${transform.y}px) scale(${transform.zoom})`

  try {
    return await render(viewportEl, exportWidth, exportHeight)
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

/**
 * Downloads a session's canonical JSON (as returned by serialize_knowledge,
 * see mcpTools.getFullGraphAsJson) as a .json file. Deliberately separate
 * from exportGraphAsPng/exportGraphAsSvg above: those need a mounted
 * ReactFlow canvas (useReactFlow().getNodes() for measured node sizes),
 * so they only work inside GraphCanvas. This one just needs the raw
 * session data, so it can be triggered from anywhere -- e.g. the logo
 * menu's "Export graph" item (App.tsx), without navigating to the Graph
 * page or waiting on canvas measurement.
 */
export function downloadGraphAsJson(
  serializedJson: string,
  fileName = 'cks-graph.json',
): void {
  const blob = new Blob([serializedJson], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  try {
    downloadDataUrl(url, fileName)
  } finally {
    // Revoke on a timeout, not synchronously -- some browsers cancel an
    // in-flight download if the object URL is revoked before the click
    // handler's navigation actually starts.
    setTimeout(() => URL.revokeObjectURL(url), 1000)
  }
}

export async function exportGraphAsPng(options: ExportOptions): Promise<void> {
  const { toPng } = await import('html-to-image')
  const { backgroundColor = '#111827' } = options
  const dataUrl = await withFramedViewport(
    options,
    (viewportEl, width, height) =>
      toPng(viewportEl, {
        backgroundColor,
        width,
        height,
        // Fixed at 3x regardless of canvas size: this is what makes large,
        // >200-node graphs stay legible on retina displays instead of
        // going soft once the bigger bounding-box canvas above gets scaled
        // down to fit the screen when viewed.
        pixelRatio: PIXEL_RATIO,
      }),
  )
  downloadDataUrl(dataUrl, options.fileName ?? 'cks-graph.png')
}

export async function exportGraphAsSvg(options: ExportOptions): Promise<void> {
  const { toSvg } = await import('html-to-image')
  const { backgroundColor = '#111827' } = options
  const dataUrl = await withFramedViewport(
    options,
    (viewportEl, width, height) =>
      toSvg(viewportEl, {
        backgroundColor,
        width,
        height,
      }),
  )
  downloadDataUrl(dataUrl, options.fileName ?? 'cks-graph.svg')
}
