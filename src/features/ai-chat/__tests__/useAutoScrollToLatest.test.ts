// Copyright (c) 2026 Deus Corp. Licensed under MIT.

import { act, renderHook } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { useAutoScrollToLatest } from '../useAutoScrollToLatest'

/** Minimal stand-in for the scroll container -- only the geometry the
 *  hook reads (scrollHeight/scrollTop/clientHeight) matters. */
function makeContainer({
  scrollHeight = 1000,
  scrollTop = 0,
  clientHeight = 400,
} = {}) {
  return { scrollHeight, scrollTop, clientHeight } as HTMLElement
}

function makeItem() {
  return { scrollIntoView: vi.fn() } as unknown as HTMLElement
}

afterEach(() => {
  vi.restoreAllMocks()
})

describe('useAutoScrollToLatest', () => {
  it('scrolls the newest item into view when itemCount grows', () => {
    const { result, rerender } = renderHook(
      ({ itemCount }) =>
        useAutoScrollToLatest<HTMLElement, HTMLElement>(itemCount),
      { initialProps: { itemCount: 1 } },
    )

    const container = makeContainer()
    const item = makeItem()
    act(() => {
      result.current.containerRef.current = container
      result.current.lastItemRef.current = item
    })

    rerender({ itemCount: 2 })

    expect(item.scrollIntoView).toHaveBeenCalledWith({
      block: 'start',
      behavior: 'smooth',
    })
  })

  it('does not auto-scroll when the user has scrolled up away from the bottom', () => {
    const { result, rerender } = renderHook(
      ({ itemCount }) =>
        useAutoScrollToLatest<HTMLElement, HTMLElement>(itemCount),
      { initialProps: { itemCount: 1 } },
    )

    // Far from the bottom (scrollHeight - scrollTop - clientHeight = 500,
    // well past the 64px "near bottom" threshold).
    const container = makeContainer({
      scrollHeight: 1000,
      scrollTop: 100,
      clientHeight: 400,
    })
    const item = makeItem()
    act(() => {
      result.current.containerRef.current = container
      result.current.lastItemRef.current = item
    })

    act(() => {
      result.current.handleScroll()
    })

    rerender({ itemCount: 2 })

    expect(item.scrollIntoView).not.toHaveBeenCalled()
  })

  it('resumes auto-scrolling once the user scrolls back near the bottom', () => {
    const { result, rerender } = renderHook(
      ({ itemCount }) =>
        useAutoScrollToLatest<HTMLElement, HTMLElement>(itemCount),
      { initialProps: { itemCount: 1 } },
    )

    const container = makeContainer({
      scrollHeight: 1000,
      scrollTop: 100,
      clientHeight: 400,
    })
    const item = makeItem()
    act(() => {
      result.current.containerRef.current = container
      result.current.lastItemRef.current = item
    })
    act(() => {
      result.current.handleScroll()
    })

    // User scrolls back down, within the near-bottom threshold.
    container.scrollTop = 590
    act(() => {
      result.current.handleScroll()
    })

    rerender({ itemCount: 2 })

    expect(item.scrollIntoView).toHaveBeenCalledTimes(1)
  })

  it('does not scroll when itemCount is unchanged or shrinks', () => {
    const { result, rerender } = renderHook(
      ({ itemCount }) =>
        useAutoScrollToLatest<HTMLElement, HTMLElement>(itemCount),
      { initialProps: { itemCount: 2 } },
    )

    const container = makeContainer()
    const item = makeItem()
    act(() => {
      result.current.containerRef.current = container
      result.current.lastItemRef.current = item
    })

    rerender({ itemCount: 2 })
    expect(item.scrollIntoView).not.toHaveBeenCalled()

    rerender({ itemCount: 1 })
    expect(item.scrollIntoView).not.toHaveBeenCalled()
  })

  it('scrolls when itemCount grows due to the "thinking…" placeholder appearing (isSending)', () => {
    // Mirrors how ChatPanel/QuickAiPanel derive itemCount as
    // turns.length + (isSending ? 1 : 0): a send() that flips isSending
    // to true grows itemCount by one even before the real reply lands.
    const { result, rerender } = renderHook(
      ({ turnCount, isSending }) =>
        useAutoScrollToLatest<HTMLElement, HTMLElement>(
          turnCount + (isSending ? 1 : 0),
        ),
      { initialProps: { turnCount: 1, isSending: false } },
    )

    const container = makeContainer()
    const item = makeItem()
    act(() => {
      result.current.containerRef.current = container
      result.current.lastItemRef.current = item
    })

    rerender({ turnCount: 1, isSending: true })

    expect(item.scrollIntoView).toHaveBeenCalledTimes(1)
  })
})
