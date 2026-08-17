// Copyright (c) 2025 Deus Corp. Licensed under MIT.

import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { ChatMessage, ExecutedToolCall } from '@/services/mcpTools'

/**
 * Module-level (not component-local) chat state, same shape as
 * sessionStore.ts/graphExplorerStore.ts, so switching pages doesn't lose
 * the conversation (see ADR-001 §2/§4).
 *
 * History is keyed by session_id (historyBySessionId) and persisted to
 * localStorage (see the `persist` wrapper below), so:
 *  - switching the connected session restores *that* session's saved
 *    transcript instead of showing an empty chat, and
 *  - the conversation survives a page reload / the app being closed and
 *    reopened, the way a normal chat app would.
 *
 * `turns`/`rawMessages` remain top-level fields (rather than requiring
 * every consumer to select `historyBySessionId[activeSessionId]`
 * themselves) -- they're a write-through mirror of the *active*
 * session's entry, kept in sync by setActiveSession()/appendUserTurn()/
 * appendAssistantTurn()/clearHistory() below. Existing consumers
 * (ChatPanel, QuickAiPanel, useAiChat) don't need to change how they
 * read turns/rawMessages, only useAiChat needs to call
 * setActiveSession() when the connected session_id changes.
 */
export interface ChatTurn {
  role: 'user' | 'assistant'
  text: string
  toolCalls?: ExecutedToolCall[]
  /** True when this assistant turn is ai_chat's "reached the tool-call
   *  iteration limit without a final answer" result (see ADR-011 /
   *  cks_mcp.tools.ai_chat.handler) -- a distinct, retriable condition
   *  from a hard error. Drives the Retry/Continue affordance next to
   *  this specific message in ChatPanel/QuickAiPanel. */
  truncated?: boolean
}

interface SessionChatHistory {
  turns: ChatTurn[]
  rawMessages: ChatMessage[]
}

const EMPTY_HISTORY: SessionChatHistory = { turns: [], rawMessages: [] }

interface ChatState {
  /** session_id whose history turns/rawMessages currently mirror. Empty
   *  string means "no session connected yet" -- appendUserTurn/
   *  appendAssistantTurn are no-ops for a truly empty id (callers are
   *  expected to guard on having a session before sending, same as
   *  useAiChat.send() already does). */
  activeSessionId: string
  /** Persisted per-session transcripts. Keyed by session_id so
   *  reconnecting to a previously-used session restores its history. */
  historyBySessionId: Record<string, SessionChatHistory>
  turns: ChatTurn[]
  rawMessages: ChatMessage[] // passed back to ai_chat verbatim each call
  isSending: boolean
  error: string | null
  /** Модель, выбранная в селекторе ChatPanel (см. list_llm_models,
   *  cks-mcp). null означает "использовать дефолт провайдера" — ровно тот
   *  же смысл, что и не передавать 'model' в ai_chat вовсе. */
  selectedModel: string | null
  /** Switches which session's history turns/rawMessages mirror. Loads
   *  the target session's saved history (or an empty transcript if it
   *  has none yet) -- called from useAiChat whenever the connected
   *  session_id changes. No-op if already active. */
  setActiveSession: (sessionId: string) => void
  appendUserTurn: (text: string) => void
  appendAssistantTurn: (
    text: string,
    toolCalls: ExecutedToolCall[],
    rawMessages: ChatMessage[],
    truncated?: boolean,
  ) => void
  setSending: (v: boolean) => void
  setError: (e: string | null) => void
  setSelectedModel: (m: string | null) => void
  /** Clears the saved transcript for one session (defaults to the
   *  active session). Also clears the live turns/rawMessages mirror
   *  when clearing the active session. */
  clearHistory: (sessionId?: string) => void
  /** @deprecated kept for backward compatibility -- clears the active
   *  session's history, same as clearHistory() with no argument. */
  reset: () => void
}

export const useChatStore = create<ChatState>()(
  persist(
    (set, get) => ({
      activeSessionId: '',
      historyBySessionId: {},
      turns: [],
      rawMessages: [],
      isSending: false,
      error: null,
      selectedModel: null,
      setActiveSession: (sessionId) => {
        const { activeSessionId, historyBySessionId, turns, rawMessages } =
          get()
        if (sessionId === activeSessionId) return
        set((s) => {
          // Flush the outgoing session's live mirror back into the map
          // first, so nothing typed since the last append is lost (in
          // practice turns/rawMessages are already write-through, but
          // this keeps the invariant explicit and cheap).
          const nextHistory = activeSessionId
            ? {
                ...historyBySessionId,
                [activeSessionId]: { turns, rawMessages },
              }
            : historyBySessionId
          const incoming = sessionId
            ? (nextHistory[sessionId] ?? EMPTY_HISTORY)
            : EMPTY_HISTORY
          return {
            ...s,
            activeSessionId: sessionId,
            historyBySessionId: nextHistory,
            turns: incoming.turns,
            rawMessages: incoming.rawMessages,
          }
        })
      },
      appendUserTurn: (text) =>
        set((s) => {
          const turns = [...s.turns, { role: 'user' as const, text }]
          const rawMessages = [
            ...s.rawMessages,
            { role: 'user' as const, content: text },
          ]
          return {
            turns,
            rawMessages,
            historyBySessionId: s.activeSessionId
              ? {
                  ...s.historyBySessionId,
                  [s.activeSessionId]: { turns, rawMessages },
                }
              : s.historyBySessionId,
          }
        }),
      appendAssistantTurn: (text, toolCalls, rawMessages, truncated) =>
        set((s) => {
          const turns = [
            ...s.turns,
            { role: 'assistant' as const, text, toolCalls, truncated },
          ]
          return {
            turns,
            rawMessages,
            historyBySessionId: s.activeSessionId
              ? {
                  ...s.historyBySessionId,
                  [s.activeSessionId]: { turns, rawMessages },
                }
              : s.historyBySessionId,
          }
        }),
      setSending: (v) => set({ isSending: v }),
      setError: (e) => set({ error: e }),
      setSelectedModel: (m) => set({ selectedModel: m }),
      clearHistory: (sessionId) =>
        set((s) => {
          const target = sessionId ?? s.activeSessionId
          if (!target) return s
          const nextHistory = { ...s.historyBySessionId }
          delete nextHistory[target]
          const isActive = target === s.activeSessionId
          return {
            ...s,
            historyBySessionId: nextHistory,
            turns: isActive ? [] : s.turns,
            rawMessages: isActive ? [] : s.rawMessages,
            error: isActive ? null : s.error,
          }
        }),
      reset: () => get().clearHistory(),
    }),
    {
      name: 'cks-studio:chat-history',
      // Only the per-session transcripts are worth persisting -- UI/
      // in-flight state (isSending, error, the live turns/rawMessages
      // mirror, selectedModel) is either transient or already covered
      // by historyBySessionId once setActiveSession() reloads it.
      partialize: (s) => ({ historyBySessionId: s.historyBySessionId }),
    },
  ),
)
