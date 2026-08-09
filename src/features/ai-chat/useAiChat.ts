// Copyright (c) 2025 Deus Corp. Licensed under MIT.

import { useCallback } from 'react'
import { useGraphStore } from '@/features/graph-explorer/graphExplorerStore'
import {
  aiChat,
  getFullGraph,
  toolCallsMutatedGraph,
} from '@/services/mcpTools'
import { useSessionStore } from '@/services/sessionStore'
import { cksToReactFlow } from '@/shared/utils/graphUtils'
import { useChatStore } from './chatStore'

/**
 * Sends chat turns to cks-mcp's ai_chat tool and keeps the Graph tab's
 * canvas in sync when a turn's tool calls mutated the graph (ADR-001 §5:
 * full refetch after the turn completes, same path GraphPage.handleConnect
 * already uses -- no incremental per-tool patching for v1).
 */
export function useAiChat() {
  const sessionId = useSessionStore((s) => s.sessionId)
  const {
    turns,
    rawMessages,
    isSending,
    error,
    appendUserTurn,
    appendAssistantTurn,
    setSending,
    setError,
  } = useChatStore()
  const setNodes = useGraphStore((s) => s.setNodes)
  const setEdges = useGraphStore((s) => s.setEdges)

  const send = useCallback(
    async (text: string) => {
      if (!sessionId.trim()) {
        setError(
          'No active session — connect to a session on the Graph tab first.',
        )
        return
      }
      appendUserTurn(text)
      setSending(true)
      setError(null)
      try {
        const pendingMessages = [
          ...rawMessages,
          { role: 'user' as const, content: text },
        ]
        const result = await aiChat(sessionId, pendingMessages)
        appendAssistantTurn(result.reply, result.tool_calls, result.messages)

        // Same full-refetch path GraphPage.handleConnect already uses —
        // see ADR-001 §5 for why this isn't an incremental patch.
        if (toolCallsMutatedGraph(result.tool_calls)) {
          const subgraph = await getFullGraph(sessionId)
          const { nodes, edges } = cksToReactFlow(subgraph)
          setNodes(nodes)
          setEdges(edges)
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Network error')
      } finally {
        setSending(false)
      }
    },
    [
      sessionId,
      rawMessages,
      appendUserTurn,
      appendAssistantTurn,
      setSending,
      setError,
      setNodes,
      setEdges,
    ],
  )

  return { turns, isSending, error, send }
}
