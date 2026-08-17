// Copyright (c) 2026 Deus Corp. Licensed under MIT.

import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { MessageActions } from '../MessageActions'

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

describe('MessageActions', () => {
  it('copies the message text to the clipboard', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined)
    vi.stubGlobal('navigator', { clipboard: { writeText } })

    render(<MessageActions text="hello world" />)
    fireEvent.click(screen.getByRole('button', { name: /^copy$/i }))

    await vi.waitFor(() =>
      expect(writeText).toHaveBeenCalledWith('hello world'),
    )
  })

  it('shows a brief "Copied" state after copying', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined)
    vi.stubGlobal('navigator', { clipboard: { writeText } })

    render(<MessageActions text="hello world" />)
    fireEvent.click(screen.getByRole('button', { name: /^copy$/i }))

    await screen.findByRole('button', { name: /copied/i })
  })

  it('uses navigator.share when available', async () => {
    const share = vi.fn().mockResolvedValue(undefined)
    const writeText = vi.fn().mockResolvedValue(undefined)
    vi.stubGlobal('navigator', { share, clipboard: { writeText } })

    render(<MessageActions text="share me" />)
    fireEvent.click(screen.getByRole('button', { name: /share/i }))

    await vi.waitFor(() =>
      expect(share).toHaveBeenCalledWith({ text: 'share me' }),
    )
    expect(writeText).not.toHaveBeenCalled()
  })

  it('falls back to copying when navigator.share is unavailable', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined)
    vi.stubGlobal('navigator', { clipboard: { writeText } })

    render(<MessageActions text="share me" />)
    fireEvent.click(screen.getByRole('button', { name: /share/i }))

    await vi.waitFor(() => expect(writeText).toHaveBeenCalledWith('share me'))
  })

  it('falls back to copying when the user dismisses the native share sheet', async () => {
    const abortError = new DOMException('cancelled', 'AbortError')
    const share = vi.fn().mockRejectedValue(abortError)
    const writeText = vi.fn().mockResolvedValue(undefined)
    vi.stubGlobal('navigator', { share, clipboard: { writeText } })

    render(<MessageActions text="share me" />)
    fireEvent.click(screen.getByRole('button', { name: /share/i }))

    await vi.waitFor(() => expect(share).toHaveBeenCalled())
    // AbortError = user cancelled -- not a failure to fall back from.
    expect(writeText).not.toHaveBeenCalled()
  })

  it('does not render a Retry button when onRetry is not provided', () => {
    render(<MessageActions text="hi" />)
    expect(
      screen.queryByRole('button', { name: /retry/i }),
    ).not.toBeInTheDocument()
  })

  it('calls onRetry when the Retry button is clicked', () => {
    const onRetry = vi.fn()
    render(<MessageActions text="hi" onRetry={onRetry} />)
    fireEvent.click(screen.getByRole('button', { name: /retry/i }))
    expect(onRetry).toHaveBeenCalledTimes(1)
  })

  it('disables Retry while isRetrying is true', () => {
    const onRetry = vi.fn()
    render(<MessageActions text="hi" onRetry={onRetry} isRetrying />)
    expect(screen.getByRole('button', { name: /retry/i })).toBeDisabled()
  })
})
