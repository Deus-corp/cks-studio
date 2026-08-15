// Copyright (c) 2026 Deus Corp. Licensed under MIT.

import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { CompareGraphsModal } from '../CompareGraphsModal'

vi.mock('@/services/mcpTools', () => ({
  compareGraphs: vi.fn().mockResolvedValue({
    shared_object_count: 0,
    only_in_a_count: 0,
    only_in_b_count: 0,
    only_in_a: [],
    only_in_b: [],
    differences: [],
  }),
  mergeGraphs: vi.fn(),
}))

vi.mock('@/services/sessionStore', () => ({
  useSessionStore: () => ({ setSessionId: vi.fn() }),
}))

afterEach(cleanup)

function renderModal(onClose = vi.fn()) {
  return {
    onClose,
    ...render(
      <MemoryRouter>
        <button type="button">Outside trigger</button>
        <CompareGraphsModal
          graphAName="graph-a"
          graphBName="graph-b"
          onClose={onClose}
        />
      </MemoryRouter>,
    ),
  }
}

describe('CompareGraphsModal — a11y', () => {
  it('exposes dialog semantics labelled by its heading', async () => {
    renderModal()
    const dialog = await screen.findByRole('dialog')
    expect(dialog).toHaveAttribute('aria-modal', 'true')
    expect(dialog).toHaveAccessibleName(/compare: graph-a vs graph-b/i)
  })

  it('moves focus into the dialog on open', async () => {
    renderModal()
    await waitFor(() => {
      expect(screen.getByRole('dialog')).toHaveFocus()
    })
  })

  it('calls onClose on Escape', async () => {
    const { onClose } = renderModal()
    await screen.findByRole('dialog')

    fireEvent.keyDown(document, { key: 'Escape' })

    expect(onClose).toHaveBeenCalled()
  })

  it('restores focus to the previously-focused element on unmount', async () => {
    const trigger = document.createElement('button')
    trigger.textContent = 'trigger'
    document.body.appendChild(trigger)
    trigger.focus()
    expect(document.activeElement).toBe(trigger)

    const { unmount } = renderModal()
    await waitFor(() => {
      expect(document.activeElement).not.toBe(trigger)
    })

    unmount()

    expect(document.activeElement).toBe(trigger)
    trigger.remove()
  })

  it('traps Tab within the dialog', async () => {
    renderModal()
    const dialog = await screen.findByRole('dialog')
    const closeButton = screen.getByRole('button', { name: /close/i })

    // Shift+Tab from the first focusable element (Close, which sits
    // first in DOM order in the header) should wrap around to the last
    // focusable element in the dialog rather than escaping to the page
    // behind it.
    closeButton.focus()
    fireEvent.keyDown(dialog, { key: 'Tab', shiftKey: true })

    const focusable = dialog.querySelectorAll(
      'button, input, a[href], select, textarea',
    )
    const last = focusable[focusable.length - 1]
    expect(document.activeElement).toBe(last)
    expect(document.activeElement).not.toBe(document.body)
  })
})
