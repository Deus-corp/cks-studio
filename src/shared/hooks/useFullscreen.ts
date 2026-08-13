// Copyright (c) 2025 Deus Corp. Licensed under MIT.

import { type RefObject, useCallback, useEffect, useState } from 'react'

/**
 * Wraps the browser Fullscreen API for a single container element, used
 * by both GraphCanvas (2D, via a react-flow ControlButton) and
 * GraphCanvas3D (via a standalone overlay button) so neither has to
 * duplicate the request/exit/`fullscreenchange` bookkeeping.
 *
 * `isFullscreen` is derived from `document.fullscreenElement` (not just
 * "did we call requestFullscreen") so it stays correct if the person
 * exits via Esc or a browser chrome button rather than our own toggle.
 */
export function useFullscreen(containerRef: RefObject<HTMLElement | null>) {
  const [isFullscreen, setIsFullscreen] = useState(false)

  useEffect(() => {
    const handleChange = () => {
      setIsFullscreen(
        document.fullscreenElement !== null &&
          document.fullscreenElement === containerRef.current,
      )
    }
    document.addEventListener('fullscreenchange', handleChange)
    return () => document.removeEventListener('fullscreenchange', handleChange)
  }, [containerRef])

  const toggleFullscreen = useCallback(() => {
    const el = containerRef.current
    if (!el) return
    if (document.fullscreenElement === el) {
      document.exitFullscreen().catch(() => {
        // Some browsers reject exitFullscreen if nothing is actually
        // fullscreen anymore (e.g. a race with an Esc keypress) --
        // nothing useful to surface to the user in that case.
      })
    } else {
      el.requestFullscreen().catch(() => {
        // Fullscreen can be denied (permissions-policy, iframe without
        // `allow="fullscreen"`, etc.) -- fail silently rather than
        // throwing an unhandled rejection; the button just won't
        // visually toggle, which is enough feedback.
      })
    }
  }, [containerRef])

  return { isFullscreen, toggleFullscreen }
}
