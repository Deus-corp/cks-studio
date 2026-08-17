// Copyright (c) 2026 Deus Corp. Licensed under MIT.

import { useCallback, useState } from 'react'
import { IconButton } from '@/components/common/IconButton'

/** Copies text to the clipboard and flips a brief "Copied" state for
 *  visual feedback -- shared by both the standalone Copy button and
 *  Share's fallback path below, so both end up with the same
 *  success/failure behavior. `navigator.clipboard` can be undefined
 *  (non-secure context, some embedders) or reject (permissions), in
 *  which case this quietly no-ops rather than throwing into an
 *  onClick handler -- there's nothing actionable for the user to do
 *  about a clipboard permission failure beyond trying again. */
function useCopyToClipboard() {
  const [copied, setCopied] = useState(false)

  const copy = useCallback(async (text: string) => {
    if (typeof navigator === 'undefined' || !navigator.clipboard) return
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1500)
    } catch {
      // Nothing actionable to surface -- see comment above.
    }
  }, [])

  return { copied, copy }
}

const CopyIcon = (
  <svg
    width="12"
    height="12"
    viewBox="0 0 24 24"
    fill="none"
    aria-hidden="true"
  >
    <rect
      x="9"
      y="9"
      width="12"
      height="12"
      rx="2"
      stroke="currentColor"
      strokeWidth="2"
    />
    <path
      d="M5 15H4a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v1"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
)

const CheckIcon = (
  <svg
    width="12"
    height="12"
    viewBox="0 0 24 24"
    fill="none"
    aria-hidden="true"
  >
    <path
      d="M20 6 9 17l-5-5"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
)

const RetryIcon = (
  <svg
    width="12"
    height="12"
    viewBox="0 0 24 24"
    fill="none"
    aria-hidden="true"
  >
    <path
      d="M4 4v6h6M20 20v-6h-6"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <path
      d="M5.5 15a8 8 0 0013.9 3.4M18.5 9A8 8 0 004.6 5.6"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
)

const ShareIcon = (
  <svg
    width="12"
    height="12"
    viewBox="0 0 24 24"
    fill="none"
    aria-hidden="true"
  >
    <circle cx="18" cy="5" r="3" stroke="currentColor" strokeWidth="2" />
    <circle cx="6" cy="12" r="3" stroke="currentColor" strokeWidth="2" />
    <circle cx="18" cy="19" r="3" stroke="currentColor" strokeWidth="2" />
    <path
      d="M8.6 10.5 15.4 6.5M8.6 13.5l6.8 4"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
    />
  </svg>
)

/**
 * Copy / Retry / Share icon-button row for a single chat message.
 * Shared by ChatPanel's TurnBubble and QuickAiPanel's MiniTurnBubble
 * so both surfaces get identical behavior instead of two hand-rolled
 * copies drifting apart.
 *
 * - Copy always copies `text` verbatim.
 * - Retry is opt-in via `onRetry` (only user turns pass one -- see
 *   TurnBubble/MiniTurnBubble -- resending an *assistant* turn isn't a
 *   thing this architecture supports, and the trailing turn's own
 *   error/truncated-continue affordances already live in
 *   ChatErrorBanner and the Continue button respectively, so this
 *   never duplicates either of those).
 * - Share uses the Web Share API when available (mobile browsers,
 *   some desktop browsers behind a secure context), falling back to
 *   copy-to-clipboard everywhere else -- same fallback behavior the
 *   issue asked for.
 */
export function MessageActions({
  text,
  onRetry,
  isRetrying,
  size = 'sm',
}: {
  text: string
  onRetry?: () => void
  isRetrying?: boolean
  size?: 'sm' | 'md'
}) {
  const { copied, copy } = useCopyToClipboard()

  const handleShare = useCallback(async () => {
    if (typeof navigator !== 'undefined' && navigator.share) {
      try {
        await navigator.share({ text })
        return
      } catch (e) {
        // AbortError = the user closed the native share sheet without
        // picking anything -- not a failure worth falling back for.
        if ((e as Error)?.name === 'AbortError') return
      }
    }
    await copy(text)
  }, [text, copy])

  const iconClassName =
    '!shadow-none !border-transparent !bg-transparent text-text-tertiary hover:!text-text-secondary hover:!bg-surface-2'

  return (
    <div className="flex items-center gap-0.5">
      <IconButton
        onClick={() => copy(text)}
        label={copied ? 'Copied' : 'Copy'}
        title={copied ? 'Copied!' : 'Copy message'}
        size={size}
        className={iconClassName}
        icon={copied ? CheckIcon : CopyIcon}
      />
      {onRetry && (
        <IconButton
          onClick={onRetry}
          disabled={isRetrying}
          label="Retry"
          title="Resend this message"
          size={size}
          className={iconClassName}
          icon={
            <span
              className={isRetrying ? 'animate-spin inline-flex' : undefined}
            >
              {RetryIcon}
            </span>
          }
        />
      )}
      <IconButton
        onClick={handleShare}
        label="Share"
        title="Share message"
        size={size}
        className={iconClassName}
        icon={ShareIcon}
      />
    </div>
  )
}
