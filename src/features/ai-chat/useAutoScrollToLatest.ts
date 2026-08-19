// Copyright (c) 2026 Deus Corp. Licensed under MIT.

import { useCallback, useEffect, useRef } from 'react'

/** How close to the bottom (in px) the user has to be for a new message
 *  to still auto-scroll. Anything further away is treated as "the user
 *  deliberately scrolled up to read older messages" and left alone. */
const NEAR_BOTTOM_THRESHOLD_PX = 64

/**
 * Keeps a scrollable message list (QuickAiPanel, ChatPanel) showing the
 * newest turn without fighting a user who's deliberately scrolled up to
 * read older messages.
 *
 * Behavior:
 * - Whenever `itemCount` grows (a user message is sent, or an assistant
 *   reply/"thinking…" placeholder is appended), scroll so the *top* of
 *   the newest item is in view (`block: 'start'`) -- not all the way to
 *   the bottom, so a long reply doesn't jump straight to its last line.
 * - That auto-scroll only fires if the user was already near the bottom
 *   right before the new item arrived (or on the very first item). Once
 *   someone scrolls up to reread earlier turns, new messages stop
 *   yanking the view until they scroll back down themselves.
 *
 * `containerRef` must be attached to the scrollable element and
 * `onScroll` wired to its `onScroll` handler so this hook can track
 * "is the user near the bottom" as it changes. `lastItemRef` must be
 * attached to the wrapper element of the *last* rendered turn.
 */
export function useAutoScrollToLatest<
  TContainer extends HTMLElement,
  TItem extends HTMLElement,
>(itemCount: number) {
  const containerRef = useRef<TContainer | null>(null)
  const lastItemRef = useRef<TItem | null>(null)
  // Starts true so the very first message (nothing to have scrolled away
  // from yet) still scrolls into view.
  const stickToLatestRef = useRef(true)
  const prevItemCountRef = useRef(itemCount)

  const handleScroll = useCallback(() => {
    const el = containerRef.current
    if (!el) return
    const distanceFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight
    stickToLatestRef.current = distanceFromBottom <= NEAR_BOTTOM_THRESHOLD_PX
  }, [])

  useEffect(() => {
    const grew = itemCount > prevItemCountRef.current
    prevItemCountRef.current = itemCount
    if (!grew) return
    if (!stickToLatestRef.current) return
    // A new item just mounted -- ref is attached before this effect runs
    // (refs update during the commit phase, effects fire after).
    lastItemRef.current?.scrollIntoView({ block: 'start', behavior: 'smooth' })
  }, [itemCount])

  return { containerRef, lastItemRef, handleScroll }
}
