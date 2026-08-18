// Copyright (c) 2025 Deus Corp. Licensed under MIT.

import { useCallback, useEffect, useState } from 'react'
import { useGraphStore } from '@/features/graph-explorer/graphExplorerStore'
import {
  type AiChatResult,
  aiChat,
  type ChatMessage,
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

/** ai_chat's iteration-cap fallback reply text (see cks_mcp.tools.ai_chat.
 *  handler) -- used as a fallback detector when talking to an older
 *  cks-mcp build that doesn't yet send the structured `truncated` flag,
 *  so the Retry/Continue affordance still works either way. */
const ITERATION_LIMIT_REPLY =
  'Reached the tool-call iteration limit without a final answer.'

function isTruncatedResult(result: AiChatResult): boolean {
  return result.truncated === true || result.reply === ITERATION_LIMIT_REPLY
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
    setActiveSession,
    clearHistory,
  } = useChatStore()
  const setNodes = useGraphStore((s) => s.setNodes)
  const setEdges = useGraphStore((s) => s.setEdges)
  const bumpGraphVersion = useGraphStore((s) => s.bumpGraphVersion)
  const [error, setError] = useState<ChatError | null>(null)

  // Load (or start) this session's saved chat history whenever the
  // connected session changes -- without this, switching sessions on
  // the Graph page reset the chat transcript to empty instead of
  // showing the session it's now connected to (see chatStore.ts's
  // historyBySessionId).
  useEffect(() => {
    setActiveSession(sessionId.trim())
  }, [sessionId, setActiveSession])

  // Model used for the most recent attempt (initial send or retry), so a
  // retry re-uses the same override rather than silently switching back
  // to whatever's currently selected in the model dropdown.
  const [lastModel, setLastModel] = useState<string | null | undefined>(
    undefined,
  )

  /**
   * Sends `pendingMessages` (the full running transcript, already
   * including the turn being attempted) to ai_chat and handles the
   * result. Shared by `send` (which first appends a new user turn) and
   * `retry` (which re-attempts the same trailing user turn already in
   * `rawMessages`/`turns` after a failure) so a retry can't duplicate
   * the user's message.
   */
  const attempt = useCallback(
    async (
      pendingMessages: ChatMessage[],
      model: string | null | undefined,
    ) => {
      setError(null)
      setSending(true)
      try {
        const result = await aiChat(
          sessionId,
          pendingMessages,
          model !== undefined ? model : selectedModel,
        )

        if (isAiChatErrorResult(result)) {
          setError(classifyAiChatErrorCode(result.error, result.message))
          return
        }

        appendAssistantTurn(
          result.reply,
          result.tool_calls,
          result.messages,
          isTruncatedResult(result),
        )

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
          bumpGraphVersion()
        } else if (toolCallsMutatedGraph(result.tool_calls)) {
          // Same full-refetch path GraphPage.handleConnect already
          // uses -- see ADR-001 §5 for why this isn't an incremental
          // patch.
          const subgraph = await getFullGraph(sessionId)
          const { nodes, edges } = cksToReactFlow(subgraph)
          setNodes(nodes)
          setEdges(edges)
          // Lets WhyThisBeliefPanel (and anything else caching a read
          // against "the current graph") know the underlying data just
          // changed, even if it's already open on the same node and
          // wouldn't otherwise re-fetch -- see graphVersion's doc
          // comment in graphExplorerStore.
          bumpGraphVersion()
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
      selectedModel,
      appendAssistantTurn,
      setSending,
      setNodes,
      setEdges,
      setSessionId,
      bumpGraphVersion,
    ],
  )

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

      appendUserTurn(text)
      setLastModel(model)
      const pendingMessages = [
        ...rawMessages,
        { role: 'user' as const, content: text },
      ]
      await attempt(pendingMessages, model)
    },
    [sessionId, rawMessages, appendUserTurn, attempt],
  )

  /**
   * Re-attempts the most recent turn after a failure, without appending
   * a second copy of the user's message: `rawMessages` already ends
   * with it (from the `send()` call that failed), same as `turns`.
   * No-op if there's no error to retry, or the trailing turn somehow
   * isn't a user turn (nothing sensible to resend).
   */
  /**
   * Re-attempts the most recent turn -- either after a failure (from
   * ChatErrorBanner) or via the per-message Retry button on the
   * trailing user bubble (MessageActions) -- without appending a
   * second copy of the user's message: `rawMessages` already ends
   * with it (from the `send()` call that produced it), same as
   * `turns`. No-op if the trailing turn somehow isn't a user turn
   * (nothing sensible to resend). Deliberately does NOT require an
   * existing `error` -- the message-level Retry button is offered on
   * the last user turn regardless of whether that turn's reply
   * succeeded, same as most chat UIs' "regenerate/resend" affordance,
   * and gating it on `error` here previously forced callers to fall
   * back to `send()` (which does append a duplicate user turn) for
   * that case -- see the regression tests in ChatPanel/QuickAiPanel.
   */
  const retry = useCallback(async () => {
    if (turns.length === 0 || turns[turns.length - 1].role !== 'user') return
    await attempt(rawMessages, lastModel)
  }, [turns, rawMessages, lastModel, attempt])

  /**
   * Resumes the most recent turn after it hit ai_chat's tool-call
   * iteration cap (ChatTurn.truncated), by resending the same running
   * transcript -- which already ends with that truncated assistant
   * turn, not a user turn -- so the LLM continues from where it left
   * off instead of the user's message being duplicated. Distinct from
   * retry() above, which only fires after a hard error and expects the
   * trailing turn to still be the user's.
   */
  const continueTruncated = useCallback(async () => {
    if (turns.length === 0) return
    const last = turns[turns.length - 1]
    if (last.role !== 'assistant' || !last.truncated) return
    await attempt(rawMessages, lastModel)
  }, [turns, rawMessages, lastModel, attempt])

  /** Clears the current session's saved chat history (and any pending
   *  error banner) -- exposed to ChatPanel/QuickAiPanel's "Clear chat"
   *  button. */
  const clearChat = useCallback(() => {
    clearHistory(sessionId.trim() || undefined)
    setError(null)
  }, [clearHistory, sessionId])

  return {
    turns,
    isSending,
    error,
    selectedModel,
    send,
    retry,
    continueTruncated,
    clearChat,
  }
}
