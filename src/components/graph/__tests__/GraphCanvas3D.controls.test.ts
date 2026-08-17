// Copyright (c) 2026 Deus Corp. Licensed under MIT.

import { describe, expect, it } from 'vitest'
// Vite's `?raw` suffix imports the file as a plain string -- see
// GraphCanvas3D.cardTheme.test.ts for why this is the pattern used to
// lock down pieces of GraphCanvas3D that can't be rendered in tests (no
// WebGL context available in jsdom).
// @ts-expect-error -- see comment above; no `vite/client` types in this project
import componentSource from '../GraphCanvas3D.tsx?raw'

// Regression coverage for the "3D fullscreen button should be replaced
// by the same zoom/fit/fullscreen controls block 2D has" bug report.
// GraphCanvas3D can't be mounted in jsdom (3d-force-graph needs a real
// WebGL context), so this locks down the source instead of the render:
// the standalone fullscreen-only button must be gone, and a controls
// block reusing react-flow's own CSS classes (so 2D/3D controls stay
// visually identical -- see styles/graph.css) must expose all four
// actions.
describe('GraphCanvas3D controls block', () => {
  it('does not render a standalone fullscreen-only IconButton anymore', () => {
    // The old markup was a single <IconButton onClick={toggleFullscreen}
    // label={...fullscreen} .../> with no zoom/fit siblings around it.
    expect(componentSource).not.toMatch(
      /<IconButton\s+onClick=\{toggleFullscreen\}/,
    )
  })

  it('reuses the same react-flow__controls classes as the 2D controls block', () => {
    expect(componentSource).toContain('className="react-flow__controls"')
    expect(componentSource).toContain('className="react-flow__controls-button"')
  })

  it('wires up zoom in, zoom out, fit view, and fullscreen actions', () => {
    expect(componentSource).toContain("handleZoomKey('in')")
    expect(componentSource).toContain("handleZoomKey('out')")
    expect(componentSource).toMatch(/onClick=\{handleFitAll\}/)
    expect(componentSource).toMatch(/onClick=\{toggleFullscreen\}/)
  })

  it('defines handleFitAll as a zoomToFit call with no node filter (fits the whole graph)', () => {
    const match = componentSource.match(
      /const handleFitAll = useCallback\(\(\) => \{[\s\S]*?\n {2}\}, \[\]\)/,
    )
    expect(match).not.toBeNull()
    expect(match?.[0]).toContain('graph.zoomToFit(700, 80)')
  })
})
