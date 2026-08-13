// Copyright (c) 2026 Deus Corp. Licensed under MIT.

import { describe, expect, it, vi } from 'vitest'
import {
  CARD_THEME_COLORS,
  disposeNodeObject3D,
  drawNodeCardCanvas,
  LINK_THEME_COLORS,
} from '../GraphCanvas3D'

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

// Regression test for the leak fixed alongside enterFocus/exitFocus/
// relationDraft: those call `nodeThreeObject(nodeThreeObject())` to force
// 3d-force-graph to rebuild every node's three.js object, but the
// library doesn't dispose the outgoing one -- disposeNodeObject3D must
// be called manually first, or every focus/relation-draft toggle leaks
// a texture+material per node (the actual cause of session-long lag,
// not the theme toggle itself -- see GraphCanvas3D.tsx for the full
// writeup).
describe('disposeNodeObject3D', () => {
  it('disposes every geometry, material, and texture in the object tree', async () => {
    const THREE = await import('three')
    const canvas = document.createElement('canvas')
    canvas.width = 4
    canvas.height = 4
    const texture = new THREE.CanvasTexture(canvas)
    const spriteMaterial = new THREE.SpriteMaterial({ map: texture })
    const sprite = new THREE.Sprite(spriteMaterial)

    const ringGeometry = new THREE.RingGeometry(1, 2, 8)
    const ringMaterial = new THREE.MeshBasicMaterial()
    const ring = new THREE.Mesh(ringGeometry, ringMaterial)

    const group = new THREE.Group()
    group.add(sprite)
    group.add(ring)

    const textureDispose = vi.spyOn(texture, 'dispose')
    const spriteMaterialDispose = vi.spyOn(spriteMaterial, 'dispose')
    const ringGeometryDispose = vi.spyOn(ringGeometry, 'dispose')
    const ringMaterialDispose = vi.spyOn(ringMaterial, 'dispose')

    disposeNodeObject3D(group)

    expect(textureDispose).toHaveBeenCalledOnce()
    expect(spriteMaterialDispose).toHaveBeenCalledOnce()
    expect(ringGeometryDispose).toHaveBeenCalledOnce()
    expect(ringMaterialDispose).toHaveBeenCalledOnce()
  })

  it('is a no-op for undefined (a node with no three.js object yet)', () => {
    expect(() => disposeNodeObject3D(undefined)).not.toThrow()
  })
})

// Locks in the always-on card border and the theme-aware link colors --
// the link color used to be a single fixed value regardless of theme,
// which read fine on the dark canvas but had poor contrast on the light
// one.
describe('theme-aware borders and link colors', () => {
  it('gives light and dark themes distinct card border colors', () => {
    expect(CARD_THEME_COLORS.light.border).not.toBe(
      CARD_THEME_COLORS.dark.border,
    )
  })

  it('gives light and dark themes distinct, non-empty link colors', () => {
    expect(LINK_THEME_COLORS.light.normal).not.toBe(
      LINK_THEME_COLORS.dark.normal,
    )
    expect(LINK_THEME_COLORS.light.highlighted).not.toBe(
      LINK_THEME_COLORS.dark.highlighted,
    )
    for (const theme of ['light', 'dark'] as const) {
      expect(LINK_THEME_COLORS[theme].normal.length).toBeGreaterThan(0)
      expect(LINK_THEME_COLORS[theme].highlighted.length).toBeGreaterThan(0)
    }
  })
})
