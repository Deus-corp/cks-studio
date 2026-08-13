// Copyright (c) 2026 Deus Corp. Licensed under MIT.

import { describe, expect, it, vi } from 'vitest'
import {
  CARD_THEME_COLORS,
  disposeNodeObject3D,
  drawNodeCardCanvas,
  LINK_THEME_COLORS,
} from '../GraphCanvas3D'
// Vite's `?raw` suffix imports the file as a plain string -- lets the
// dependency-array test below assert against the actual source text
// without needing @types/node (not installed in this project) for
// node:fs/node:path. No project-wide `vite/client` ambient types are
// referenced anywhere else in this repo, so declare this one specific
// import's shape locally rather than adding a global types reference.
// @ts-expect-error -- see comment above; no `vite/client` types in this project
import componentSource from '../GraphCanvas3D.tsx?raw'

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

// Regression test for the *second* occurrence of the same dependency-array
// bug: the mount effect that builds the scene was fixed to depend on
// `theme` (see the test above / that effect's own comment), but the
// separate debounced theme-refresh effect (themeRefreshTimerRef) was
// later added with `[]` instead of `[theme]` -- so it scheduled its one
// refresh on mount and then never again on any subsequent toggle. This
// isn't reachable through drawNodeCardCanvas/CARD_THEME_COLORS directly
// (both of those were correct), and the effect's own WebGL side effects
// aren't unit-testable per the note above, so this asserts the dependency
// array at the source level instead of leaving it to only a code comment,
// which is what let it regress silently the first time.
describe('theme-refresh debounce effect dependencies', () => {
  it('the themeRefreshTimerRef effect depends on `theme`, not `[]`', () => {
    const effectStart = componentSource.indexOf(
      'themeRefreshTimerRef.current = setTimeout',
    )
    expect(effectStart).toBeGreaterThan(-1)
    const effectEnd = componentSource.indexOf('\n  }, [', effectStart)
    expect(effectEnd).toBeGreaterThan(-1)
    const depsClose = componentSource.indexOf(')', effectEnd)
    const depsArray = componentSource.slice(effectEnd + 6, depsClose + 1)
    expect(depsArray).toBe('[theme])')
  })
})

// Locks in the specific light-theme card colors requested to fix the
// "card border only visible on hover" readability problem: the previous
// border (#c2c5cc) had almost no contrast against the canvas background
// (--color-surface-0 #f5f4f0). A saturated amber fill with a white label
// makes the card unmistakable with or without a border/hover state.
describe('light theme card colors', () => {
  it('uses the requested amber background with white text', () => {
    expect(CARD_THEME_COLORS.light.background).toBe('#a66f1f')
    expect(CARD_THEME_COLORS.light.text).toBe('#ffffff')
  })

  it('gives the light theme card a border with real contrast against the canvas', () => {
    // Canvas background is --color-surface-0 (#f5f4f0). A border color
    // needs to differ from that by more than a token gray-on-gray step
    // to actually read as an edge rather than disappear into the canvas
    // the way the old #c2c5cc border did.
    const toRgb = (hex: string) => {
      const n = Number.parseInt(hex.slice(1), 16)
      return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
    }
    const canvasBg = toRgb('#f5f4f0')
    const border = toRgb(CARD_THEME_COLORS.light.border)
    const distance = Math.sqrt(
      canvasBg.reduce((sum, c, i) => sum + (c - border[i]) ** 2, 0),
    )
    // The old border (#c2c5cc) sits at a distance of ~68 from the
    // canvas background -- the reported bug. Require meaningfully more
    // separation than that.
    expect(distance).toBeGreaterThan(150)
  })
})

// Locks in that card textures never carry mipmaps: these are flat,
// camera-facing billboards drawn once at a fixed supersampled
// resolution (CARD_TEXTURE_SCALE), not a textured 3D surface with a
// real minification range -- generating a full mip chain on every
// texture.needsUpdate (i.e. on every card, every theme toggle) was pure
// overhead and the main contributor to theme toggles stalling the whole
// app, not just the 3D canvas.
describe('card texture filtering', () => {
  it('creates card textures with mipmaps disabled', () => {
    expect(componentSource).toContain('texture.generateMipmaps = false')
    expect(componentSource).toContain('texture.minFilter = THREE.LinearFilter')
  })
})

// Locks in that the full-graph card refresh is batched across animation
// frames rather than looping every node synchronously in one pass --
// the other main contributor to "the whole studio lags" after a theme
// toggle on a larger graph.
describe('card texture refresh batching', () => {
  it('processes card texture refreshes in batches via requestAnimationFrame', () => {
    expect(componentSource).toContain('CARD_REFRESH_BATCH_SIZE')
    expect(componentSource).toContain('requestAnimationFrame(processBatch)')
  })

  it('abandons a stale in-flight refresh via a generation counter', () => {
    expect(componentSource).toContain('refreshGenerationRef')
  })
})
