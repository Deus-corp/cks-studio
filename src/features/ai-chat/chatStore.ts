// Copyright (c) 2025 Deus Corp. Licensed under MIT.

import type { ChatMessage, ExecutedToolCall } from '@/services/mcpTools'
import { create } from 'zustand'

/**
 * Module-level (not component-local) chat state, same shape as
 * sessionStore.ts/graphExplorerStore.ts, so switching pages doesn't lose
 * the conversation (see ADR-001 §2/§4).
 */
export interface ChatTurn {
  role: 'user' | 'assistant'
  text: string
  toolCalls?: ExecutedToolCall[]
}

interface ChatState {
  turns: ChatTurn[]
  rawMessages: ChatMessage[] // passed back to ai_chat verbatim each call
  isSending: boolean
  error: string | null
  appendUserTurn: (text: string) => void
  appendAssistantTurn: (
    text: string,
    toolCalls: ExecutedToolCall[],
    rawMessages: ChatMessage[],
  ) => void
  setSending: (v: boolean) => void
  setError: (e: string | null) => void
  reset: () => void
}

export const useChatStore = create<ChatState>((set) => ({
  turns: [],
  rawMessages: [],
  isSending: false,
  error: null,
  appendUserTurn: (text) =>
    set((s) => ({
      turns: [...s.turns, { role: 'user', text }],
      rawMessages: [...s.rawMessages, { role: 'user', content: text }],
    })),
  appendAssistantTurn: (text, toolCalls, rawMessages) =>
    set((s) => ({
      turns: [...s.turns, { role: 'assistant', text, toolCalls }],
      rawMessages,
    })),
  setSending: (v) => set({ isSending: v }),
  setError: (e) => set({ error: e }),
  reset: () => set({ turns: [], rawMessages: [], error: null }),
}))
