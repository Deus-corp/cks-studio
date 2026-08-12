// Copyright (c) 2026 Deus Corp. Licensed under MIT.

interface DemoTurn {
  role: 'user' | 'assistant'
  text: string
  toolCalls?: string[]
}

const SAMPLE_CONVERSATION: DemoTurn[] = [
  {
    role: 'user',
    text: 'What is cks-mcp and how does it relate to cks-runtime?',
  },
  {
    role: 'assistant',
    text: "cks-mcp is the MCP server that exposes CKS's knowledge-lifecycle tools (construct, query, evolve, merge, ...) to LLMs over stdio or HTTP. It's the \"llm_interface\" component — it doesn't own storage or reasoning itself, it calls into cks-runtime, which is the operational layer that actually persists graphs and runs the background sweepers. I looked up both components in the connected graph to check their declared roles.",
    toolCalls: [
      "query_subgraph({ seed_ids: ['cks-mcp', 'cks-runtime'], depth: 1 })",
    ],
  },
  {
    role: 'user',
    text: 'Which sweeper would catch two facts that contradict each other?',
  },
  {
    role: 'assistant',
    text: 'That would be the ContradictionSweeper (agent_id "contradiction"). It runs periodically over the graph looking for logically incompatible statements and escalates them as gossip/inference conflict tasks for a Critic agent to resolve — you can see its live status on the Agents tab once connected to a real server.',
  },
]

function TurnBubble({ turn }: { turn: DemoTurn }) {
  const isUser = turn.role === 'user'
  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
      <div
        className={`max-w-[80%] rounded-lg px-3 py-2 text-sm whitespace-pre-wrap break-words ${
          isUser
            ? 'bg-accent text-white'
            : 'bg-surface-1 border border-border-subtle text-text-primary'
        }`}
      >
        {turn.text}
        {!isUser && turn.toolCalls && turn.toolCalls.length > 0 && (
          <div className="mt-1.5 text-xs">
            <div className="text-text-tertiary">
              ▸ {turn.toolCalls.length} tool call
              {turn.toolCalls.length === 1 ? '' : 's'}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

/**
 * Static stand-in for ChatPanel: a canned conversation showing what
 * ai_chat looks like in practice, with the same bubble layout as the real
 * panel. The input is visible (so the page still reads as "Chat", not a
 * transcript viewer) but disabled -- this demo never calls an LLM.
 */
export function DemoChatPage() {
  return (
    <div className="h-full flex flex-col">
      <div className="flex items-center gap-3 px-4 py-3 border-b border-border-subtle">
        <h2 className="text-sm font-semibold text-text-primary">Chat</h2>
        <span className="text-xs text-text-tertiary">
          Sample conversation — connect to cks-mcp for live chat
        </span>
      </div>

      <div className="px-4 py-2 border-b border-border-subtle bg-yellow-950/40 text-yellow-400 text-xs">
        Demo only — this is a recorded example conversation. No LLM is called
        from this page.
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {SAMPLE_CONVERSATION.map((turn, i) => (
          // biome-ignore lint/suspicious/noArrayIndexKey: static sample list, never reordered
          <TurnBubble key={i} turn={turn} />
        ))}
      </div>

      <form
        onSubmit={(e) => e.preventDefault()}
        className="flex items-center gap-2 border-t border-border bg-surface-1 px-4 py-4"
      >
        <div className="relative flex-1">
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            aria-hidden="true"
            className="absolute left-3 top-3 text-text-tertiary pointer-events-none"
          >
            <path
              d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"
              stroke="currentColor"
              strokeWidth="1.6"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          <input
            type="text"
            disabled
            placeholder="Demo only — connect to cks-mcp for live chat"
            className="w-full bg-surface-2 border border-border rounded pl-8 pr-3 py-2.5 text-sm text-text-primary placeholder-text-tertiary disabled:opacity-50"
          />
        </div>
        <button
          type="submit"
          disabled
          className="text-xs bg-accent text-white px-3 py-2.5 rounded opacity-40 cursor-not-allowed"
        >
          Send
        </button>
      </form>
    </div>
  )
}
