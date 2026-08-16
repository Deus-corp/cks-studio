// Copyright (c) 2025 Deus Corp. Licensed under MIT.

import { useCallback, useState } from 'react'
import { useGraphStore } from '@/features/graph-explorer/graphExplorerStore'
import {
  type AiChatResult,
  aiChat,
  type ExecutedToolCall,
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
/** Tool names whose successful result may carry a freshly-created
 *  `session_id` that the caller didn't ask for by name -- e.g.
 *  `validate_knowledge`/`construct_knowledge` called with no
 *  `session_id` argument, which mints a new session rather than
 *  operating on the one already connected (see ADR-001 / the studio
 *  bug this fixes: the Graph page silently kept showing the old graph,
 *  or an empty one, after Quick AI created a new one). Kept as an
 *  explicit set, same reasoning as `GRAPH_MUTATING_TOOLS` above --
 *  there's no tool-metadata flag for "this tool can mint a session"
 *  yet. */
const SESSION_CREATING_TOOLS = new Set([
  'validate_knowledge',
  'construct_knowledge',
])

/** Scans a completed ai_chat turn's tool_calls for a successful
 *  session-creating tool call whose result carries a `session_id`
 *  different from the one the turn was sent against. Returns the most
 *  recent such id, or null if none. Only ever returns a *different*
 *  id -- a session-creating tool called with an explicit session_id
 *  (operating on the session already connected) reports that same id
 *  back and must not trigger a switch. */
function findNewSessionId(
  calls: ExecutedToolCall[],
  currentSessionId: string,
): string | null {
  let found: string | null = null
  for (const call of calls) {
    if (call.is_error || !SESSION_CREATING_TOOLS.has(call.name)) continue
    const resultSessionId = call.result?.session_id
    if (
      typeof resultSessionId === 'string' &&
      resultSessionId.trim() &&
      resultSessionId !== currentSessionId
    ) {
      found = resultSessionId
    }
  }
  return found
}

export function useAiChat() {
  const sessionId = useSessionStore((s) => s.sessionId)
  const setSessionId = useSessionStore((s) => s.setSessionId)
  const {
    turns,
    rawMessages,
    isSending,
    selectedModel,
    appendUserTurn,
    appendAssistantTurn,
    setSending,
  } = useChatStore()
  const setNodes = useGraphStore((s) => s.setNodes)
  const setEdges = useGraphStore((s) => s.setEdges)
  const [error, setError] = useState<ChatError | null>(null)

  const send = useCallback(
    // `model` overrides the store's selectedModel for this one call, if
    // given; ChatPanel normally doesn't pass it and relies on the store
    // value set by its <select>, but tests/callers can force a value.
    async (text: string, model?: string | null) => {
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
        const result = await aiChat(
          sessionId,
          pendingMessages,
          model !== undefined ? model : selectedModel,
        )

        if (isAiChatErrorResult(result)) {
          setError(classifyAiChatErrorCode(result.error, result.message))
          return
        }

        appendAssistantTurn(result.reply, result.tool_calls, result.messages)

        // Quick AI / full Chat can create a brand-new session (e.g.
        // validate_knowledge/construct_knowledge called with no
        // session_id) rather than operate on the one already
        // connected. Without switching to it here, the Graph page
        // keeps showing the old (or an empty) graph, and the session
        // id the assistant just mentioned in its reply doesn't
        // actually exist anywhere in the UI's own state -- entering it
        // by hand into the Graph page's session field is the only way
        // to see it. Detect that case and adopt the new session as
        // the connected one before refetching.
        const newSessionId = findNewSessionId(result.tool_calls, sessionId)
        if (newSessionId) {
          setSessionId(newSessionId)
          const subgraph = await getFullGraph(newSessionId)
          const { nodes, edges } = cksToReactFlow(subgraph)
          setNodes(nodes)
          setEdges(edges)
        } else if (toolCallsMutatedGraph(result.tool_calls)) {
          // Same full-refetch path GraphPage.handleConnect already
          // uses -- see ADR-001 §5 for why this isn't an incremental
          // patch.
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
      selectedModel,
      appendUserTurn,
      appendAssistantTurn,
      setSending,
      setNodes,
      setEdges,
      setSessionId,
    ],
  )

  return { turns, isSending, error, selectedModel, send }
}
