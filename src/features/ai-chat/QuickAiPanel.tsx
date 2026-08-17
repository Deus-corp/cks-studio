// Copyright (c) 2026 Deus Corp. Licensed under MIT.

import { memo, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { IconButton } from '@/components/common/IconButton'
import { useSessionStore } from '@/services/sessionStore'
import { useSettingsStore } from '@/shared/stores/settingsStore'
import type { ChatTurn } from './chatStore'
import { useAiChat } from './useAiChat'

/** How many of the most recent turns the compact history shows -- the
 *  full back-and-forth is still one click away via "Open full Chat",
 *  this is meant for quick, disposable questions, not a scrollback. */
const VISIBLE_TURN_COUNT = 6

function MiniTurnBubble({
  turn,
  onContinue,
  isSending,
}: {
  turn: ChatTurn
  onContinue?: () => void
  isSending?: boolean
}) {
  const isUser = turn.role === 'user'
  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
      <div
        className={`max-w-[85%] rounded-lg px-2.5 py-1.5 text-xs whitespace-pre-wrap break-words ${
          isUser
            ? 'bg-chat-user-bg text-text-primary'
            : 'bg-surface-2 border border-border-subtle text-text-primary'
        }`}
      >
        {turn.text}
        {!isUser && turn.truncated && onContinue && (
          <div className="mt-1.5">
            <button
              type="button"
              onClick={onContinue}
              disabled={isSending}
              title="Ask the LLM to continue from here"
              className="text-[11px] text-text-secondary hover:text-text-primary border border-border-subtle hover:border-border rounded px-1.5 py-0.5 disabled:opacity-50"
            >
              {isSending ? 'Continuing…' : 'Continue'}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
const MemoizedMiniTurnBubble = memo(MiniTurnBubble)

/**
 * Compact chat panel for quick questions from the Graph page, without
 * leaving the canvas. Deliberately reuses useAiChat()/useChatStore
 * as-is rather than local state: that store is already module-level
 * (see chatStore.ts), so this panel and the full /chat page share the
 * exact same conversation -- "Open full Chat" is then just a navigation,
 * nothing needs to be copied over.
 */
export function QuickAiPanel() {
  // Read once at mount (not subscribed) -- this only seeds the initial
  // open/closed state per Settings 2.0's "Open Quick AI by default"
  // toggle; changing the setting later shouldn't yank an already-open
  // or already-closed panel out from under the user mid-session.
  const [isOpen, setIsOpen] = useState(
    () => useSettingsStore.getState().quickAiPanelDefaultOpen,
  )
  const [input, setInput] = useState('')
  const sessionId = useSessionStore((s) => s.sessionId)
  const { turns, isSending, error, send, retry, continueTruncated, clearChat } =
    useAiChat()
  const navigate = useNavigate()

  const hasSession = Boolean(sessionId.trim())
  const visibleTurns = useMemo(() => turns.slice(-VISIBLE_TURN_COUNT), [turns])

  const handleSend = () => {
    const text = input.trim()
    if (!text || isSending || !hasSession) return
    setInput('')
    send(text)
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  const handleInput = (e: React.FormEvent<HTMLTextAreaElement>) => {
    const el = e.currentTarget
    el.style.height = 'auto'
    el.style.height = `${Math.min(el.scrollHeight, 96)}px`
  }

  if (!isOpen) {
    return (
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        aria-expanded={false}
        title="Quick AI chat"
        className="bg-surface-1/95 backdrop-blur-sm border border-border-subtle hover:border-border rounded-md px-3 py-2 text-[10px] font-display font-semibold uppercase tracking-wider text-text-tertiary hover:text-text-secondary shadow-lg transition-colors select-none"
      >
        Quick AI
      </button>
    )
  }

  return (
    <div className="w-80 max-w-[calc(100vw-2rem)] bg-surface-1/95 backdrop-blur-sm border border-border-subtle rounded-md shadow-lg flex flex-col overflow-hidden">
      <div className="flex items-center justify-between gap-2 px-3 py-2 border-b border-border-subtle shrink-0">
        <span className="font-display text-[10px] font-semibold uppercase tracking-wider text-text-tertiary">
          Quick AI
        </span>
        <div className="flex items-center gap-1">
          <IconButton
            onClick={() => {
              if (turns.length === 0) return
              if (
                typeof window !== 'undefined' &&
                !window.confirm("Clear this session's chat history?")
              ) {
                return
              }
              clearChat()
            }}
            disabled={turns.length === 0}
            label="Clear chat"
            title="Clear chat history for this session"
            size="sm"
            className="!shadow-none !border-transparent !bg-transparent text-text-tertiary hover:!text-text-secondary hover:!bg-surface-2 disabled:opacity-40"
            icon={
              <svg
                width="13"
                height="13"
                viewBox="0 0 24 24"
                fill="none"
                aria-hidden="true"
              >
                <path
                  d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            }
          />
          <IconButton
            onClick={() => navigate('/chat')}
            label="Open full Chat"
            size="sm"
            className="!shadow-none !border-transparent !bg-transparent text-accent hover:!text-accent-strong hover:!bg-surface-2"
            icon={
              <svg
                width="13"
                height="13"
                viewBox="0 0 24 24"
                fill="none"
                aria-hidden="true"
              >
                <path
                  d="M7 17L17 7M9 7h8v8"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            }
          />
          <IconButton
            onClick={() => setIsOpen(false)}
            label="Close panel"
            title="Close"
            size="sm"
            className="!shadow-none !border-transparent !bg-transparent hover:!bg-surface-2"
            icon={<span className="text-xs leading-none">✕</span>}
          />
        </div>
      </div>

      {!hasSession ? (
        <p className="px-3 py-3 text-xs text-text-tertiary">
          Connect to a session on this page first.
        </p>
      ) : (
        <>
          <div
            className="overflow-y-auto px-3 py-2 space-y-1.5"
            style={{ maxHeight: '16rem' }}
          >
            {visibleTurns.length === 0 && !isSending && (
              <p className="text-[11px] text-text-tertiary">
                Ask a quick question about this session.
              </p>
            )}
            {visibleTurns.map((turn, i) => (
              <MemoizedMiniTurnBubble
                // biome-ignore lint/suspicious/noArrayIndexKey: turns have no stable id
                key={i}
                turn={turn}
                onContinue={
                  i === visibleTurns.length - 1 ? continueTruncated : undefined
                }
                isSending={isSending}
              />
            ))}
            {isSending && (
              <div className="flex justify-start">
                <div className="rounded-lg px-2.5 py-1.5 text-xs bg-surface-2 border border-border-subtle text-text-tertiary">
                  thinking…
                </div>
              </div>
            )}
          </div>

          {error && (
            <div className="flex items-center justify-between gap-2 px-3 py-1.5 border-t border-border-subtle">
              <p className="text-[11px] text-red-400">{error.message}</p>
              {(error.kind === 'llm_call_failed' ||
                error.kind === 'network' ||
                error.kind === 'other') && (
                <button
                  type="button"
                  onClick={() => retry()}
                  disabled={isSending}
                  title="Resend the last message"
                  className="shrink-0 text-[11px] text-red-400 hover:text-red-300 border border-red-400/40 hover:border-red-300/60 rounded px-1.5 py-0.5 disabled:opacity-50"
                >
                  {isSending ? 'Retrying…' : 'Retry'}
                </button>
              )}
            </div>
          )}

          <div className="flex items-end gap-1.5 border-t border-border-subtle p-2">
            <textarea
              rows={1}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onInput={handleInput}
              onKeyDown={handleKeyDown}
              placeholder="Ask anything… (Enter to send)"
              disabled={isSending}
              className="flex-1 bg-surface-2 border border-border rounded px-2 py-1.5 text-xs text-text-primary placeholder-text-tertiary focus:outline-none focus:border-accent disabled:opacity-50 resize-none max-h-24 overflow-y-auto leading-normal"
            />
            <button
              type="button"
              onClick={handleSend}
              disabled={isSending || !input.trim()}
              className="text-xs bg-accent hover:bg-accent-strong text-white px-2.5 py-1.5 rounded disabled:opacity-40 disabled:cursor-not-allowed shrink-0"
            >
              Send
            </button>
          </div>
        </>
      )}
    </div>
  )
}
