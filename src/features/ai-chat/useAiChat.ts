// Copyright (c) 2025 Deus Corp. Licensed under MIT.

import { useCallback, useState } from 'react'
import { useGraphStore } from '@/features/graph-explorer/graphExplorerStore'
import {
  type AiChatResult,
  aiChat,
  getFullGraph,
  toolCallsMutatedGraph,
} from '@/services/mcpTools'
import { useSessionStore } from '@/services/sessionStore'
import { cksToReactFlow } from '@/shared/utils/graphUtils'
import { useChatStore } from './chatStore'

/**
 * A user-facing chat error, tagged with *why* it happened so ChatPanel can
 * render a different banner (and different next steps) per kind, instead of
 * dumping a raw error.message under the form the way this used to work.
 */
export type ChatErrorKind =
  | 'no_session' // guard below fired -- send() never called ai_chat
  | 'llm_provider_unavailable' // ai_chat's own {'error': ...} result
  | 'llm_call_failed' // ai_chat's own {'error': ...} result
  | 'other' // ai_chat's own {'error': ...} result, unrecognized code
  | 'network' // fetch/transport/JSON-RPC failure -- see catch block below

export interface ChatError {
  kind: ChatErrorKind
  message: string
}

/**
 * ai_chat (cks-mcp ADR-011 §4) reports its own business-level failures --
 * no LLM provider configured, the configured provider errored -- as a
 * normal successful tool result shaped like
 * {'error': string, 'message': string, 'tool_calls': [...], 'messages': [...]},
 * not by throwing. mcpTools.aiChat() types its return as the success shape
 * (AiChatResult) regardless, so this is a runtime check, not something
 * TypeScript can narrow for us.
 */
function isAiChatErrorResult(
  result: AiChatResult,
): result is AiChatResult & { error: string; message: string } {
  return typeof (result as { error?: unknown }).error === 'string'
}

function classifyAiChatErrorCode(code: string, rawMessage: string): ChatError {
  const message = rawMessage || 'Unknown error.'
  if (code === 'llm_provider_unavailable') {
    return { kind: 'llm_provider_unavailable', message }
  }
  if (code === 'llm_call_failed') {
    return {
      kind: 'llm_call_failed',
      message: `LLM call failed: ${message} Try again or check Settings.`,
    }
  }
  return { kind: 'other', message }
}

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
    appendUserTurn,
    appendAssistantTurn,
    setSending,
  } = useChatStore()
  const setNodes = useGraphStore((s) => s.setNodes)
  const setEdges = useGraphStore((s) => s.setEdges)
  const [error, setError] = useState<ChatError | null>(null)

  const send = useCallback(
    async (text: string) => {
      // Checked before ai_chat is ever called (not after a failed round-
      // trip) so a user without a session gets the "go connect one" nudge
      // instantly, with no server involved.
      if (!sessionId.trim()) {
        setError({
          kind: 'no_session',
          message: 'Connect to a session on the Graph page first.',
        })
        return
      }

      setError(null)
      appendUserTurn(text)
      setSending(true)
      try {
        const pendingMessages = [
          ...rawMessages,
          { role: 'user' as const, content: text },
        ]
        const result = await aiChat(sessionId, pendingMessages)

        if (isAiChatErrorResult(result)) {
          setError(classifyAiChatErrorCode(result.error, result.message))
          return
        }

        appendAssistantTurn(result.reply, result.tool_calls, result.messages)

        // Same full-refetch path GraphPage.handleConnect already uses —
        // see ADR-001 §5 for why this isn't an incremental patch.
        if (toolCallsMutatedGraph(result.tool_calls)) {
          const subgraph = await getFullGraph(sessionId)
          const { nodes, edges } = cksToReactFlow(subgraph)
          setNodes(nodes)
          setEdges(edges)
        }
      } catch {
        // fetch() network failures, non-2xx HTTP responses, and JSON-RPC-
        // level errors (see mcpClient.callTool) are the only things that
        // land here -- ai_chat's own business-level errors are handled
        // above without throwing, so anything reaching this block means
        // cks-mcp itself couldn't be reached or didn't answer sanely.
        setError({
          kind: 'network',
          message: 'Could not reach cks-mcp. Is the server running?',
        })
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
      setNodes,
      setEdges,
    ],
  )

  return { turns, isSending, error, send }
}
