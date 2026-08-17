// Copyright (c) 2026 Deus Corp. Licensed under MIT.

import { describe, expect, it } from 'vitest'
// See GraphCanvas3D.cardTheme.test.ts for why `?raw` source-text
// assertions are used here: GraphPage pulls in the full graph explorer
// stack (session connect, SSE, GraphCanvas/GraphCanvas3D, etc.), so a
// full render for a handful of layout/className regressions is heavier
// than asserting the fix is actually present in the markup that ships.
// @ts-expect-error -- no `vite/client` types in this project
import pageSource from '../GraphPage.tsx?raw'

describe('GraphPage layout and button styling fixes', () => {
  it('constrains the main content row and sidebar height so long SidePanel content scrolls instead of stretching the page', () => {
    // Both the flex row and the <aside> itself need min-h-0 -- a flex
    // item's default min-height:auto lets its content push it (and the
    // row) taller instead of respecting overflow-y-auto. See the
    // "SidePanel can grow arbitrarily tall" bug report.
    expect(pageSource).toContain('<div className="flex-1 flex min-h-0">')
    expect(pageSource).toMatch(
      /<aside className="relative z-10 w-72 min-h-0 border-l/,
    )
    expect(pageSource).toContain('overflow-y-auto')
  })

  it('gives Clear Highlight the same shadow as other sidebar buttons', () => {
    expect(pageSource).toMatch(
      /onClick=\{clearHighlight\}\s*\n\s*className="[^"]*shadow-lg/,
    )
  })

  it('vertically centers Reset graph against Clear Highlight', () => {
    // The row used to default to align-items: stretch, top-aligning the
    // fixed-height Reset graph IconButton against the taller Clear
    // Highlight button instead of centering it.
    expect(pageSource).toContain('<div className="flex items-center gap-1.5">')
  })
})
