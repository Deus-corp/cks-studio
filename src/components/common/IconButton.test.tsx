// Copyright (c) 2025 Deus Corp. Licensed under MIT.

import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { IconButton } from './IconButton'

afterEach(() => cleanup())

const dot = <svg aria-hidden="true" width="10" height="10" />

describe('IconButton', () => {
  it('renders with an accessible name from `label`', () => {
    render(<IconButton icon={dot} label="Refresh graph" onClick={() => {}} />)
    expect(
      screen.getByRole('button', { name: 'Refresh graph' }),
    ).toBeInTheDocument()
  })

  it('sets `title` to `label` by default', () => {
    render(<IconButton icon={dot} label="Refresh graph" onClick={() => {}} />)
    expect(screen.getByRole('button')).toHaveAttribute('title', 'Refresh graph')
  })

  it('allows overriding the tooltip text independently of aria-label', () => {
    render(
      <IconButton
        icon={dot}
        label="Focus mode"
        title="Focus mode on — click a node to isolate its neighborhood"
        onClick={() => {}}
      />,
    )
    const button = screen.getByRole('button', { name: 'Focus mode' })
    expect(button).toHaveAttribute(
      'title',
      'Focus mode on — click a node to isolate its neighborhood',
    )
  })

  it('triggers onClick when clicked', () => {
    const onClick = vi.fn()
    render(<IconButton icon={dot} label="Clone" onClick={onClick} />)
    fireEvent.click(screen.getByRole('button', { name: 'Clone' }))
    expect(onClick).toHaveBeenCalledTimes(1)
  })

  it('does not trigger onClick when disabled', () => {
    const onClick = vi.fn()
    render(<IconButton icon={dot} label="Clone" onClick={onClick} disabled />)
    const button = screen.getByRole('button', { name: 'Clone' })
    expect(button).toBeDisabled()
    fireEvent.click(button)
    expect(onClick).not.toHaveBeenCalled()
  })

  it('sets aria-pressed when `active` is provided', () => {
    render(
      <IconButton icon={dot} label="Focus mode" active onClick={() => {}} />,
    )
    expect(screen.getByRole('button')).toHaveAttribute('aria-pressed', 'true')
  })
})
