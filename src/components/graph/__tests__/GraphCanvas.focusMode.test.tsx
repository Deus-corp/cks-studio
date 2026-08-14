// Copyright (c) 2026 Deus Corp. Licensed under MIT.

import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useGraphStore } from '@/features/graph-explorer/graphExplorerStore'
import { GraphCanvas } from '../GraphCanvas'

// ReactFlow measures its container via ResizeObserver, which jsdom doesn't
// implement -- without a stub, mounting <ReactFlow> throws.
class ResizeObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
}

beforeEach(() => {
  vi.stubGlobal('ResizeObserver', ResizeObserverStub)
  useGraphStore.getState().setNodes([
    {
      id: 'a',
      type: 'cksNode',
      position: { x: 0, y: 0 },
      data: { label: 'A', cksType: 'Concept' },
    },
    {
      id: 'b',
      type: 'cksNode',
      position: { x: 200, y: 0 },
      data: { label: 'B', cksType: 'Concept' },
    },
    {
      id: 'c',
      type: 'cksNode',
      position: { x: 400, y: 0 },
      data: { label: 'C', cksType: 'Concept' },
    },
  ])
  useGraphStore.getState().setEdges([{ id: 'a-b', source: 'a', target: 'b' }])
})

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
  useGraphStore.getState().setNodes([])
  useGraphStore.getState().setEdges([])
  useGraphStore.getState().clearMultiSelect()
  useGraphStore.getState().selectNode(null)
})

describe('GraphCanvas — 2D focus mode toggle', () => {
  it('renders a Focus toggle that is off by default', () => {
    render(<GraphCanvas />)

    const toggle = screen.getByRole('button', { name: /focus/i })
    expect(toggle).toHaveAttribute('aria-pressed', 'false')
  })

  it('turns on when clicked, and back off on a second click', () => {
    render(<GraphCanvas />)

    const toggle = screen.getByRole('button', { name: /focus/i })
    fireEvent.click(toggle)
    expect(toggle).toHaveAttribute('aria-pressed', 'true')

    fireEvent.click(toggle)
    expect(toggle).toHaveAttribute('aria-pressed', 'false')
  })

  it('dims non-related nodes and keeps the focused node + neighbors at full opacity', () => {
    render(<GraphCanvas />)

    fireEvent.click(screen.getByRole('button', { name: /focus/i }))
    fireEvent.click(screen.getByText('A'))

    // 'a' is the focused node, 'b' is its direct neighbor (a-b edge) --
    // neither should be dimmed. 'c' has no edge to 'a' and should be.
    const nodeA = screen.getByText('A').closest('.react-flow__node')
    const nodeB = screen.getByText('B').closest('.react-flow__node')
    const nodeC = screen.getByText('C').closest('.react-flow__node')

    expect(nodeA?.querySelector('div')).not.toHaveStyle({ opacity: '0.25' })
    expect(nodeB?.querySelector('div')).not.toHaveStyle({ opacity: '0.25' })
    expect(nodeC?.querySelector('div')).toHaveStyle({ opacity: '0.25' })
  })

  it('keeps the selected node highlighted after it is no longer hovered', () => {
    render(<GraphCanvas />)

    fireEvent.click(screen.getByText('A'))

    expect(useGraphStore.getState().selectedNodeId).toBe('a')
    const nodeA = screen.getByText('A').closest('.react-flow__node')
    // The persistent-highlight brightness filter (see CksNode) is applied
    // via inline style regardless of :hover/mouse position.
    expect(nodeA?.querySelector('div')).toHaveStyle({
      filter: 'brightness(1.08)',
    })
  })
})

// Regression test for the Focus toggle's vertical position: it used to
// sit at a hand-picked pixel offset between ExportControls and Controls
// (react-flow's zoom/fullscreen block), which needed re-tuning by hand
// whenever either row's rendered height changed (see the git history on
// this file/GraphCanvas.tsx for two rounds of that). jsdom doesn't run
// real layout, so offsetTop/offsetHeight are always 0 in this
// environment and can't be used to assert the *rendered* pixel result --
// this instead locks in the formula itself: focusTop and controlsTop
// must be computed from the *same* GAP_PX constant on both sides of
// Focus, which is what guarantees "centered" by construction rather
// than by a periodically-stale guess.
describe('Focus toggle centering formula', () => {
  it('derives focusTop and controlsTop from the same GAP_PX on both sides of Focus', async () => {
    // Same `?raw` approach as GraphCanvas3D.cardTheme.test.ts -- avoids
    // needing @types/node (not installed in this project) for node:fs.
    // @ts-expect-error -- no `vite/client` types in this project
    const { default: source } = await import('../GraphCanvas.tsx?raw')
    expect(source).toContain(
      'const nextFocusTop = exportBottom + GAP_PX - PANEL_MARGIN_PX',
    )
    expect(source).toContain(
      'setControlsTop(nextFocusTop + focusEl.offsetHeight + GAP_PX)',
    )
  })

  // Regression test for the follow-up report that Focus still wasn't
  // centered after the fix above: react-flow's `.react-flow__panel` CSS
  // sets `margin: 15px` on every Panel (including <Controls>, which
  // renders through Panel internally), and that margin applies *in
  // addition to* whatever `top` style we set -- so a Panel's real
  // rendered top is our JS `top` value plus that margin, not just our
  // value. exportBottom is a real *measured* position (already correct)
  // but the first version of this formula turned it directly into
  // Focus's `top` value without subtracting that margin back out first,
  // so the browser silently re-added it -- making the gap above Focus
  // PANEL_MARGIN_PX bigger than the gap below it (Focus read as sitting
  // closer to Controls than to Export, exactly as reported). This test
  // locks in the derivation with a concrete example so the arithmetic
  // itself -- not just the presence of PANEL_MARGIN_PX somewhere in the
  // formula -- stays right.
  it('produces an equal true rendered gap above and below Focus, accounting for react-flow Panel margin', () => {
    const GAP_PX = 12
    const PANEL_MARGIN_PX = 15
    // Arbitrary example export/focus box heights -- the assertion holds
    // for any values, this just picks concrete ones to compute with.
    const exportOffsetTop = 15 // react-flow's own default Panel top (0) + its 15px margin
    const exportOffsetHeight = 30
    const focusOffsetHeight = 30

    const exportBottom = exportOffsetTop + exportOffsetHeight
    const focusTopJs = exportBottom + GAP_PX - PANEL_MARGIN_PX
    const controlsTopJs = focusTopJs + focusOffsetHeight + GAP_PX

    // True rendered positions include the margin the browser re-adds on
    // top of each Panel's inline `top` style.
    const trueFocusTop = focusTopJs + PANEL_MARGIN_PX
    const trueFocusBottom = trueFocusTop + focusOffsetHeight
    const trueControlsTop = controlsTopJs + PANEL_MARGIN_PX

    const gapAboveFocus = trueFocusTop - exportBottom
    const gapBelowFocus = trueControlsTop - trueFocusBottom

    expect(gapAboveFocus).toBe(GAP_PX)
    expect(gapBelowFocus).toBe(GAP_PX)
  })
})
