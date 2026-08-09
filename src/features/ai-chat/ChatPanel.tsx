// Copyright (c) 2025 Deus Corp. Licensed under MIT.

import { useState } from 'react'
import type { ExecutedToolCall } from '@/services/mcpTools'
import type { ChatTurn } from './chatStore'
import { useAiChat } from './useAiChat'

/**
 * Collapsed-by-default list of tool calls an assistant turn made — tool
 * name, a short argument summary, success/error. Direct requirement from
 * ADR-001 §6 ("ошибки и предупреждения от ИИ видны в том же чате"),
 * mirroring AgentPanel's actionError-under-the-card convention: errors
 * surface inline, next to the thing that failed, not as a toast.
 */
function ToolCallsDisclosure({ calls }: { calls: ExecutedToolCall[] }) {
  const [open, setOpen] = useState(false)
  if (calls.length === 0) return null

  const errorCount = calls.filter((c) => c.is_error).length

  return (
    <div className="mt-1.5 text-xs">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="text-gray-500 hover:text-gray-300 transition-colors"
      >
        {open ? '▾' : '▸'} {calls.length} tool call
        {calls.length === 1 ? '' : 's'}
        {errorCount > 0 && (
          <span className="text-red-400"> ({errorCount} failed)</span>
        )}
      </button>

      {open && (
        <div className="mt-1 space-y-1">
          {calls.map((call, i) => (
            <div
              // biome-ignore lint/suspicious/noArrayIndexKey: calls have no stable id
              key={i}
              className={`rounded px-2 py-1 border ${
                call.is_error
                  ? 'border-red-900 bg-red-950/40'
                  : 'border-gray-800 bg-gray-900'
              }`}
            >
              <div className="flex items-center gap-1.5">
                <span
                  className={`w-1.5 h-1.5 rounded-full inline-block flex-shrink-0 ${
                    call.is_error ? 'bg-red-500' : 'bg-green-500'
                  }`}
                />
                <span className="font-mono text-gray-300">{call.name}</span>
              </div>
              <div className="text-gray-500 font-mono truncate">
                {JSON.stringify(call.arguments)}
              </div>
              {call.is_error && (
                <div className="text-red-400 break-words">
                  {JSON.stringify(call.result)}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function TurnBubble({ turn }: { turn: ChatTurn }) {
  const isUser = turn.role === 'user'
  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
      <div
        className={`max-w-[80%] rounded-lg px-3 py-2 text-sm whitespace-pre-wrap break-words ${
          isUser
            ? 'bg-accent text-white'
            : 'bg-gray-900 border border-gray-800 text-gray-200'
        }`}
      >
        {turn.text}
        {!isUser && turn.toolCalls && (
          <ToolCallsDisclosure calls={turn.toolCalls} />
        )}
      </div>
    </div>
  )
}

/**
 * Interactive chat panel: a human types a prompt, cks-mcp's ai_chat tool
 * decides which of its ~60 tools to call, and the graph tab updates live
 * (ADR-001). Dumb presentational panel + thin page wrapper, same split as
 * AgentPanel.tsx/AgentsPage.tsx.
 */
export function ChatPanel() {
  const { turns, isSending, error, send } = useAiChat()
  const [input, setInput] = useState('')

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const text = input.trim()
    if (!text || isSending) return
    setInput('')
    send(text)
  }

  return (
    <div className="h-full flex flex-col">
      <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-800">
        <h2 className="text-sm font-semibold text-gray-200">Chat</h2>
        <span className="text-xs text-gray-500">
          Talks to cks-mcp's ai_chat tool, scoped to the connected session.
        </span>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {turns.length === 0 && !isSending && (
          <p className="text-xs text-gray-500">
            Ask for something — e.g. "add a Person node named Ada Lovelace and
            connect her to the Analytical Engine with a designed relation".
          </p>
        )}
        {turns.map((turn, i) => (
          // biome-ignore lint/suspicious/noArrayIndexKey: turns have no stable id
          <TurnBubble key={i} turn={turn} />
        ))}
        {isSending && (
          <div className="flex justify-start">
            <div className="rounded-lg px-3 py-2 text-sm bg-gray-900 border border-gray-800 text-gray-500">
              thinking…
            </div>
          </div>
        )}
      </div>

      {error && (
        <p className="text-red-400 text-xs px-4 py-2 border-t border-gray-800">
          {error}
        </p>
      )}

      <form
        onSubmit={handleSubmit}
        className="flex items-center gap-2 border-t border-gray-800 p-3"
      >
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Type a message…"
          disabled={isSending}
          className="flex-1 bg-gray-900 border border-gray-800 rounded px-3 py-2 text-sm text-gray-200 placeholder-gray-600 focus:outline-none focus:border-accent disabled:opacity-50"
        />
        <button
          type="submit"
          disabled={isSending || !input.trim()}
          className="text-xs bg-accent hover:bg-accent-strong text-white px-3 py-2 rounded disabled:opacity-40 disabled:cursor-not-allowed"
        >
          Send
        </button>
      </form>
    </div>
  )
}
