// Copyright (c) 2026 Deus Corp. Licensed under MIT.

import { useEffect, useId, useRef, useState } from 'react'
import { visualizeGraph } from '@/services/mcpTools'

// mermaid is a large dependency (parser + per-diagram-type renderers);
// dynamically imported inside the effect below, the same code-splitting
// approach GraphPage.tsx already uses for GraphCanvas3D (three.js), so
// pages that never open a gallery card's preview never pay for it.
type MermaidModule = import('mermaid').Mermaid

let mermaidModulePromise: Promise<MermaidModule> | null = null
let mermaidInitialized = false

function loadMermaid(): Promise<MermaidModule> {
  if (!mermaidModulePromise) {
    mermaidModulePromise = import('mermaid').then((m) => m.default)
  }
  return mermaidModulePromise
}

/** Reads the Studio's current theme colors from CSS custom properties
 *  (see src/styles/index.css) so the Mermaid diagram doesn't clash with
 *  whichever of the light/dark themes is active -- Mermaid has no way
 *  to pick that up on its own, it just takes a fixed color palette. */
function readMermaidThemeVariables() {
  const style = getComputedStyle(document.documentElement)
  const read = (name: string, fallback: string) =>
    style.getPropertyValue(name).trim() || fallback

  return {
    background: 'transparent',
    primaryColor: read('--color-surface-2', '#1c2230'),
    primaryTextColor: read('--color-text-primary', '#e5e7eb'),
    primaryBorderColor: read('--color-border', '#2a3142'),
    lineColor: read('--color-border', '#2a3142'),
    fontSize: '11px',
  }
}

function ensureMermaidInitialized(mermaid: MermaidModule) {
  if (mermaidInitialized) return
  mermaid.initialize({
    startOnLoad: false,
    theme: 'base',
    securityLevel: 'strict',
    themeVariables: readMermaidThemeVariables(),
  })
  mermaidInitialized = true
}

/**
 * Mini Mermaid visualization of a gallery graph, via visualize_graph
 * (mode='structure') -- the same Mermaid export an MCP client already
 * gets, just rendered inline as an SVG thumbnail instead of raw text.
 * Lazily rendered: the gallery can show many cards at once, and each
 * one is a network round-trip plus a Mermaid render, so callers should
 * only mount this once a card is actually visible/expanded rather than
 * for the whole grid up front.
 */
export function GraphPreview({ sessionId }: { sessionId: string }) {
  const [svg, setSvg] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const mountedRef = useRef(true)
  const renderId = useId().replace(/:/g, '-')

  useEffect(() => {
    mountedRef.current = true
    setIsLoading(true)
    setError(null)
    setSvg(null)

    async function run() {
      try {
        const mermaid = await loadMermaid()
        ensureMermaidInitialized(mermaid)
        const result = await visualizeGraph({
          sessionId,
          depth: 1,
          maxObjects: 12,
        })
        const { svg: rendered } = await mermaid.render(
          `graph-preview-${renderId}`,
          result.mermaid,
        )
        if (mountedRef.current) setSvg(rendered)
      } catch (e) {
        if (mountedRef.current) {
          setError(e instanceof Error ? e.message : 'Unknown error')
        }
      } finally {
        if (mountedRef.current) setIsLoading(false)
      }
    }
    run()

    return () => {
      mountedRef.current = false
    }
  }, [sessionId, renderId])

  if (isLoading) {
    return (
      <div className="h-24 flex items-center justify-center text-[10px] text-text-tertiary bg-surface-2/50 rounded">
        Rendering preview…
      </div>
    )
  }

  if (error) {
    return (
      <div className="h-24 flex items-center justify-center text-[10px] text-text-tertiary bg-surface-2/50 rounded px-2 text-center">
        Preview unavailable
      </div>
    )
  }

  const previewSrc = svg
    ? `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`
    : undefined

  return (
    <div className="h-24 overflow-hidden rounded bg-surface-2/50">
      {previewSrc ? (
        <img
          src={previewSrc}
          alt="Graph preview"
          className="w-full h-full object-contain"
        />
      ) : null}
    </div>
  )
}
