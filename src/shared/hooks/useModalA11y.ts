// Copyright (c) 2026 Deus Corp. Licensed under MIT.

import { useEffect, useRef } from 'react'

const FOCUSABLE_SELECTOR = [
  'a[href]',
  'button:not([disabled])',
  'textarea:not([disabled])',
  'input:not([disabled])',
  'select:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(',')

/**
 * Standard modal-dialog accessibility behavior, shared by every
 * fixed-overlay dialog in the app (CompareGraphsModal, PublishToGallery's
 * dialog, etc.):
 *  - Escape closes the dialog.
 *  - Focus moves into the dialog on open (the container itself, so
 *    screen readers announce its aria-label/aria-labelledby immediately;
 *    callers that want a specific field focused instead can still focus
 *    it themselves after this fires).
 *  - Tab/Shift+Tab is trapped within the dialog's focusable elements so
 *    keyboard users can't tab out into the (still-present-in-the-DOM)
 *    page behind the overlay.
 *  - Focus is restored to whatever had it before the dialog opened, once
 *    the dialog closes/unmounts -- so e.g. closing a Compare dialog
 *    opened from a Gallery card returns focus to that card instead of
 *    dropping it back to <body>.
 *
 * Returns a ref to attach to the dialog's outermost element.
 */
export function useModalA11y<T extends HTMLElement>(
  onClose: () => void,
  active = true,
): React.RefObject<T | null> {
  const containerRef = useRef<T>(null)

  useEffect(() => {
    if (!active) return
    const previouslyFocused = document.activeElement as HTMLElement | null
    const container = containerRef.current
    // Focus the container itself first (not the first focusable child):
    // it's guaranteed to exist even if the dialog's content hasn't
    // finished loading any focusable elements yet (e.g. a spinner-only
    // initial state), and screen readers still announce its
    // aria-label/aria-labelledby when a non-focusable-by-default element
    // is given tabIndex=-1 and focused programmatically.
    container?.focus()

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        event.preventDefault()
        onClose()
        return
      }
      if (event.key !== 'Tab' || !container) return

      const focusable = Array.from(
        container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR),
      ).filter((el) => el.offsetParent !== null)
      if (focusable.length === 0) {
        event.preventDefault()
        return
      }

      const first = focusable[0]
      const last = focusable[focusable.length - 1]
      const active = document.activeElement

      if (event.shiftKey) {
        if (active === first || active === container) {
          event.preventDefault()
          last.focus()
        }
      } else if (active === last) {
        event.preventDefault()
        first.focus()
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('keydown', handleKeyDown)
      previouslyFocused?.focus?.()
    }
  }, [onClose, active])

  return containerRef
}
