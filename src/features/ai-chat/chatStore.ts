// Copyright (c) 2025 Deus Corp. Licensed under MIT.

import { create } from 'zustand'
import type { ChatMessage, ExecutedToolCall } from '@/services/mcpTools'

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
  /** Модель, выбранная в селекторе ChatPanel (см. list_llm_models,
   *  cks-mcp). null означает "использовать дефолт провайдера" — ровно тот
   *  же смысл, что и не передавать 'model' в ai_chat вовсе. */
  selectedModel: string | null
  appendUserTurn: (text: string) => void
  appendAssistantTurn: (
    text: string,
    toolCalls: ExecutedToolCall[],
    rawMessages: ChatMessage[],
  ) => void
  setSending: (v: boolean) => void
  setError: (e: string | null) => void
  setSelectedModel: (m: string | null) => void
  reset: () => void
}

export const useChatStore = create<ChatState>((set) => ({
  turns: [],
  rawMessages: [],
  isSending: false,
  error: null,
  selectedModel: null,
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
  setSelectedModel: (m) => set({ selectedModel: m }),
  reset: () => set({ turns: [], rawMessages: [], error: null }),
}))
