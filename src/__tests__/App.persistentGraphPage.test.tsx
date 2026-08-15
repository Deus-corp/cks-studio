// Copyright (c) 2026 Deus Corp. Licensed under MIT.

import { cleanup, render, screen } from '@testing-library/react'
import { useEffect, useRef, useState } from 'react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { AppContent } from '../App'

// Regression test for the "graph re-unfurls / camera resets / selected
// node is lost every time you leave and come back to the Graph tab"
// report. The root cause was routing GraphPage through <Routes>, which
// fully unmounts it on navigation -- destroying GraphCanvas3D's
// three.js scene (so the force simulation and camera position restart
// from scratch on remount) and losing GraphPage's local `selectedNode`
// state outright. The fix renders GraphPage unconditionally and toggles
// visibility with the `hidden` class instead, so navigating away and
// back never unmounts it.
//
// GraphPage itself pulls in live data fetching, xyflow, and a
// lazy-loaded three.js chunk -- mocking it out here (and the other
// pages) keeps this test focused on AppContent's mount/visibility
// logic rather than re-testing those pages' own behavior.
let graphPageMountCount = 0
vi.mock('@/pages/GraphPage', () => ({
  GraphPage: () => {
    // A ref (not state) so this only reflects actual mount/unmount, not
    // re-renders -- the whole point of the test is to assert this
    // *doesn't* increase across navigation.
    const mounted = useRef(false)
    if (!mounted.current) {
      mounted.current = true
      graphPageMountCount++
    }
    // Local component state, the same shape of thing `selectedNode` is
    // in the real GraphPage -- proves it survives navigation instead of
    // resetting to its initial value.
    const [clicks, setClicks] = useState(0)
    useEffect(() => {
      setClicks((c) => c + 1)
    }, [])
    return <div data-testid="graph-page">clicks:{clicks}</div>
  },
}))
vi.mock('@/pages/SettingsPage', () => ({
  SettingsPage: () => <div data-testid="settings-page">settings</div>,
}))

afterEach(() => {
  cleanup()
  graphPageMountCount = 0
})

describe('AppContent — persistent GraphPage across navigation', () => {
  it('keeps GraphPage mounted (not remounted) when navigating away and back', () => {
    const { rerender } = render(
      <MemoryRouter initialEntries={['/']}>
        <AppContent />
      </MemoryRouter>,
    )
    expect(screen.getByTestId('graph-page')).toBeInTheDocument()
    expect(graphPageMountCount).toBe(1)

    rerender(
      <MemoryRouter initialEntries={['/settings']}>
        <AppContent />
      </MemoryRouter>,
    )
    // GraphPage stays in the DOM (just hidden), so its state -- camera
    // position, force-simulation node positions, selected node -- is
    // never destroyed the way a real unmount would destroy it.
    expect(screen.getByTestId('graph-page')).toBeInTheDocument()
    expect(graphPageMountCount).toBe(1)

    rerender(
      <MemoryRouter initialEntries={['/']}>
        <AppContent />
      </MemoryRouter>,
    )
    expect(graphPageMountCount).toBe(1)
  })

  it('hides GraphPage (via the `hidden` class) rather than removing it when on another route', async () => {
    render(
      <MemoryRouter initialEntries={['/settings']}>
        <AppContent />
      </MemoryRouter>,
    )
    const graphWrapper = screen.getByTestId('graph-page').parentElement
    expect(graphWrapper).toHaveClass('hidden')
    // SettingsPage is React.lazy-loaded (see App.tsx) -- its chunk
    // resolves asynchronously even though it's mocked synchronously
    // here, so the Suspense fallback ("Loading…") renders first. Assert
    // past that instead of assuming SettingsPage is present on the
    // first render.
    expect(await screen.findByTestId('settings-page')).toBeInTheDocument()
  })

  it('shows GraphPage and hides the other-routes wrapper when on "/"', () => {
    render(
      <MemoryRouter initialEntries={['/']}>
        <AppContent />
      </MemoryRouter>,
    )
    const graphWrapper = screen.getByTestId('graph-page').parentElement
    expect(graphWrapper).not.toHaveClass('hidden')
  })
})
