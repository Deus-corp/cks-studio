// Copyright (c) 2026 Deus Corp. Licensed under MIT.

import { memo, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useSessionStore } from '@/services/sessionStore'
import { useSettingsStore } from '@/shared/stores/settingsStore'
import type { ChatTurn } from './chatStore'
import { useAiChat } from './useAiChat'

/** How many of the most recent turns the compact history shows -- the
 *  full back-and-forth is still one click away via "Open full Chat",
 *  this is meant for quick, disposable questions, not a scrollback. */
const VISIBLE_TURN_COUNT = 6

function MiniTurnBubble({ turn }: { turn: ChatTurn }) {
  const isUser = turn.role === 'user'
  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
      <div
        className={`max-w-[85%] rounded-lg px-2.5 py-1.5 text-xs whitespace-pre-wrap break-words ${
          isUser
            ? 'bg-accent text-white'
            : 'bg-surface-2 border border-border-subtle text-text-primary'
        }`}
      >
        {turn.text}
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
  const { turns, isSending, error, send } = useAiChat()
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
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => navigate('/chat')}
            className="text-[10px] text-accent hover:text-accent-strong"
          >
            Open full Chat
          </button>
          <button
            type="button"
            onClick={() => setIsOpen(false)}
            aria-label="Close panel"
            title="Close"
            className="text-text-tertiary hover:text-text-primary rounded px-1 hover:bg-surface-2"
          >
            ✕
          </button>
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
              // biome-ignore lint/suspicious/noArrayIndexKey: turns have no stable id
              <MemoizedMiniTurnBubble key={i} turn={turn} />
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
            <p className="px-3 py-1.5 text-[11px] text-red-400 border-t border-border-subtle">
              {error.message}
            </p>
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
