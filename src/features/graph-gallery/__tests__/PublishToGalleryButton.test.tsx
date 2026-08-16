// Copyright (c) 2026 Deus Corp. Licensed under MIT.

import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { PublishToGalleryButton } from '../PublishToGalleryButton'

const { registerGraphMock } = vi.hoisted(() => ({
  registerGraphMock: vi.fn(),
}))

vi.mock('@/services/mcpTools', () => ({
  registerGraph: registerGraphMock,
}))

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

function openDialog() {
  render(<PublishToGalleryButton sessionId="sess-1" />)
  fireEvent.click(screen.getByRole('button', { name: /publish to gallery/i }))
  return screen.getByLabelText(/^name$/i)
}

describe('PublishToGalleryButton', () => {
  it('preserves cursor position while typing (no re-selection on each keystroke)', () => {
    const nameInput = openDialog() as HTMLInputElement
    nameInput.focus()

    // Regression test for the focus-stealing bug: useModalA11y's
    // focus-trap effect used to re-run (and re-steal focus onto the
    // dialog container) on every keystroke because the onClose callback
    // passed to it was a fresh arrow function each render. Typing
    // character by character and checking focus stays put (rather than
    // jumping to the dialog container) catches that regression.
    fireEvent.change(nameInput, { target: { value: 'a' } })
    fireEvent.change(nameInput, { target: { value: 'ab' } })
    fireEvent.change(nameInput, { target: { value: 'abc' } })

    expect(nameInput).toHaveValue('abc')
    expect(document.activeElement).toBe(nameInput)
  })

  it('calls registerGraph with the current sessionId and form values on submit', async () => {
    registerGraphMock.mockResolvedValue({
      registered: true,
      name: 'my-graph',
      public: false,
      visibility: 'private',
    })

    const nameInput = openDialog()
    fireEvent.change(nameInput, { target: { value: 'my-graph' } })
    fireEvent.change(screen.getByLabelText(/description/i), {
      target: { value: 'a test graph' },
    })
    fireEvent.change(screen.getByLabelText(/tags/i), {
      target: { value: 'demo, test' },
    })

    fireEvent.click(screen.getByRole('button', { name: /^publish$/i }))

    expect(registerGraphMock).toHaveBeenCalledWith({
      name: 'my-graph',
      sessionId: 'sess-1',
      description: 'a test graph',
      tags: 'demo, test',
      isPublic: false,
      visibility: 'private',
      team: undefined,
    })

    expect(
      await screen.findByText(/Published as .*my-graph/),
    ).toBeInTheDocument()
  })

  it('passes the team namespace when visibility is set to team', async () => {
    registerGraphMock.mockResolvedValue({
      registered: true,
      name: 'shared-graph',
      public: false,
      visibility: 'team',
      team: 'acme-eng',
    })

    const nameInput = openDialog()
    fireEvent.change(nameInput, { target: { value: 'shared-graph' } })
    fireEvent.click(screen.getByRole('radio', { name: /team/i }))
    fireEvent.change(screen.getByPlaceholderText(/acme-eng/i), {
      target: { value: 'acme-eng' },
    })

    fireEvent.click(screen.getByRole('button', { name: /^publish$/i }))

    expect(registerGraphMock).toHaveBeenCalledWith(
      expect.objectContaining({
        visibility: 'team',
        team: 'acme-eng',
        isPublic: false,
      }),
    )
  })

  it('shows an inline error and does not close the dialog when registerGraph fails', async () => {
    registerGraphMock.mockRejectedValue(new Error('mcp unavailable'))

    const nameInput = openDialog()
    fireEvent.change(nameInput, { target: { value: 'my-graph' } })
    fireEvent.click(screen.getByRole('button', { name: /^publish$/i }))

    expect(await screen.findByText('mcp unavailable')).toBeInTheDocument()
    // Dialog should still be open with the form visible.
    expect(screen.getByLabelText(/^name$/i)).toBeInTheDocument()
  })

  it('requires a name before submitting', () => {
    openDialog()
    fireEvent.click(screen.getByRole('button', { name: /^publish$/i }))

    expect(screen.getByText(/name is required/i)).toBeInTheDocument()
    expect(registerGraphMock).not.toHaveBeenCalled()
  })
})
