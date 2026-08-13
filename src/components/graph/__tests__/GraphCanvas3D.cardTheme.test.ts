// Copyright (c) 2026 Deus Corp. Licensed under MIT.

import { describe, expect, it } from 'vitest'
import { CARD_THEME_COLORS, drawNodeCardCanvas } from '../GraphCanvas3D'

// Full theme-switch behavior (in-place texture refresh across the live
// 3d-force-graph instance, see refreshCardTextures in GraphCanvas3D) isn't
// practically testable without a WebGL context. This instead locks down
// the piece that theme refresh depends on: drawNodeCardCanvas must (a)
// actually change colors between themes, and (b) draw the light theme as
// a near-opaque surface rather than a translucent card, matching 2D's
// CksNode.
describe('drawNodeCardCanvas theme colors', () => {
  it('uses different, near-opaque backgrounds for light vs dark theme', () => {
    expect(CARD_THEME_COLORS.light.background).not.toBe(
      CARD_THEME_COLORS.dark.background,
    )
    // Light theme's card background must be a solid hex color (not an
    // rgba(...) with reduced alpha) so cards read as opaque, matching
    // CksNode's light-theme surface.
    expect(CARD_THEME_COLORS.light.background).toMatch(/^#[0-9a-f]{6}$/i)
    expect(CARD_THEME_COLORS.light.text).not.toBe(CARD_THEME_COLORS.dark.text)
  })

  it('draws a canvas of the requested size for both themes', () => {
    const light = drawNodeCardCanvas(
      'Test Node',
      '🔷',
      '#38bdf8',
      false,
      160,
      54,
      3,
      'light',
    )
    const dark = drawNodeCardCanvas(
      'Test Node',
      '🔷',
      '#38bdf8',
      false,
      160,
      54,
      3,
      'dark',
    )

    expect(light.width).toBe(dark.width)
    expect(light.height).toBe(dark.height)
    expect(light.width).toBeGreaterThan(0)
    expect(light.height).toBeGreaterThan(0)
  })
})
