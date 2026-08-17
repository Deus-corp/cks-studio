// Copyright (c) 2025 Deus Corp. Licensed under MIT.

import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useLLMModels } from '@/features/llm-status/useLLMModels'
import { useLLMStatus } from '@/features/llm-status/useLLMStatus'
import type { ExecutedToolCall, LLMStatus } from '@/services/mcpTools'
import type { ChatTurn } from './chatStore'
import { useChatStore } from './chatStore'
import type { ChatError } from './useAiChat'
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
        className="text-text-tertiary hover:text-text-secondary transition-colors"
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
                  : 'border-border-subtle bg-surface-1'
              }`}
            >
              <div className="flex items-center gap-1.5">
                <span
                  className={`w-1.5 h-1.5 rounded-full inline-block flex-shrink-0 ${
                    call.is_error ? 'bg-red-500' : 'bg-green-500'
                  }`}
                />
                <span className="font-mono text-text-secondary">
                  {call.name}
                </span>
              </div>
              <div className="text-text-tertiary font-mono truncate">
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

/**
 * Предупреждение над историей сообщений, когда ни один LLM-провайдер не
 * настроен/недоступен на сервере (ai_chat в этом случае вернёт
 * {'error': 'llm_provider_unavailable', ...} на первую же отправку — но
 * баннер опрашивает get_llm_status сам, чтобы предупредить ДО того, как
 * пользователь напишет сообщение и получит отказ). Статус приходит сверху
 * (из ChatPanel), а не из отдельного useLLMStatus() здесь — ChatPanel
 * нужен тот же статус, чтобы решить, не дублировать ли это же
 * предупреждение в error-баннере под формой (см. ChatErrorBanner ниже).
 */
function LLMStatusBanner({ status }: { status: LLMStatus | null }) {
  if (status?.provider !== 'none') return null

  return (
    <div className="px-4 py-2 border-b border-border-subtle bg-yellow-950/40 text-yellow-400 text-xs">
      No LLM provider configured — chat won't work until one is. Start Ollama (
      <code className="font-mono">ollama run llama3.2</code>) or set
      ANTHROPIC_API_KEY, then check{' '}
      <Link to="/settings" className="underline hover:text-yellow-300">
        Settings
      </Link>
      .
    </div>
  )
}

/**
 * Error/warning banner under the input, distinct from LLMStatusBanner
 * above the message list: that one is a proactive "this won't work yet"
 * warning polled independently of any send attempt, this one reports what
 * actually happened to the *last* send attempt (ADR-001 §6 wants both --
 * a heads-up before typing, and a clear reason after a failure).
 *
 * Tone follows the kind: yellow for "you need to do something" (no
 * session, no provider), red for an actual failure (network, a
 * misconfigured/erroring provider, tool failures). 'llm_provider_
 * unavailable' is intentionally suppressed by the caller when
 * llmBannerAlreadyShown is true, so the same warning never appears twice
 * on screen at once.
 */
function ChatErrorBanner({
  error,
  onRetry,
  isRetrying,
}: {
  error: ChatError
  /** Omitted for error kinds that aren't a simple "resend the same
   *  message" fix (no_session, llm_provider_unavailable) -- those need
   *  the user to do something first, not just click retry. */
  onRetry?: () => void
  isRetrying?: boolean
}) {
  if (error.kind === 'no_session') {
    return (
      <div className="px-4 py-2 border-t border-border-subtle bg-yellow-950/40 text-yellow-400 text-xs">
        No active session. Connect to a session on the{' '}
        <Link to="/" className="underline hover:text-yellow-300">
          Graph tab
        </Link>{' '}
        first.
      </div>
    )
  }

  if (error.kind === 'llm_provider_unavailable') {
    return (
      <div className="px-4 py-2 border-t border-border-subtle bg-yellow-950/40 text-yellow-400 text-xs">
        <p>No LLM provider available. To fix this:</p>
        <ol className="mt-1 ml-4 list-decimal space-y-0.5">
          <li>
            Run <code className="font-mono">ollama run llama3.2</code>
          </li>
          <li>
            Or set <code className="font-mono">ANTHROPIC_API_KEY</code> in{' '}
            <code className="font-mono">~/.cks-mcp/.env</code>
          </li>
          <li>
            <Link to="/settings" className="underline hover:text-yellow-300">
              Open Settings
            </Link>{' '}
            to check current status
          </li>
        </ol>
      </div>
    )
  }

  // 'llm_call_failed', 'network', and 'other' are all genuine failures
  // (not "you need to configure something") -- red, not yellow. These
  // are also the kinds retry() knows how to resend, so offer a Retry
  // button alongside the message.
  return (
    <div className="flex items-center justify-between gap-2 text-red-400 text-xs px-4 py-2 border-t border-border-subtle">
      <p>{error.message}</p>
      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          disabled={isRetrying}
          className="shrink-0 flex items-center gap-1 text-red-400 hover:text-red-300 border border-red-400/40 hover:border-red-300/60 rounded px-2 py-1 disabled:opacity-50"
          title="Resend the last message"
        >
          <svg
            width="11"
            height="11"
            viewBox="0 0 24 24"
            fill="none"
            aria-hidden="true"
            className={isRetrying ? 'animate-spin' : undefined}
          >
            <path
              d="M4 4v6h6M20 20v-6h-6"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <path
              d="M5.5 15a8 8 0 0013.9 3.4M18.5 9A8 8 0 004.6 5.6"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          {isRetrying ? 'Retrying…' : 'Retry'}
        </button>
      )}
    </div>
  )
}

function TurnBubble({
  turn,
  onContinue,
  isSending,
}: {
  turn: ChatTurn
  /** Only meaningful (and only rendered) for the trailing turn when
   *  turn.truncated is set -- resends the transcript so the LLM can
   *  pick up where it left off. See useAiChat.continueTruncated. */
  onContinue?: () => void
  isSending?: boolean
}) {
  const isUser = turn.role === 'user'
  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
      <div
        className={`max-w-[80%] rounded-lg px-3 py-2 text-sm whitespace-pre-wrap break-words ${
          isUser
            ? 'bg-chat-user-bg text-text-primary'
            : 'bg-surface-1 border border-border-subtle text-text-primary'
        }`}
      >
        {turn.text}
        {!isUser && turn.toolCalls && (
          <ToolCallsDisclosure calls={turn.toolCalls} />
        )}
        {!isUser && turn.truncated && onContinue && (
          <div className="mt-2">
            <button
              type="button"
              onClick={onContinue}
              disabled={isSending}
              className="text-xs flex items-center gap-1 text-text-secondary hover:text-text-primary border border-border-subtle hover:border-border rounded px-2 py-1 disabled:opacity-50"
              title="Ask the LLM to continue from here"
            >
              <svg
                width="11"
                height="11"
                viewBox="0 0 24 24"
                fill="none"
                aria-hidden="true"
                className={isSending ? 'animate-spin' : undefined}
              >
                <path
                  d="M4 4v6h6M20 20v-6h-6"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
                <path
                  d="M5.5 15a8 8 0 0013.9 3.4M18.5 9A8 8 0 004.6 5.6"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
              {isSending ? 'Continuing…' : 'Continue'}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

/**
 * Селектор модели рядом с заголовком «Chat» (см. list_llm_models,
 * cks-mcp). Пока список моделей ещё не загрузился, показываем только
 * текущий дефолт из get_llm_status как единственный disabled-пункт —
 * без этого <select> на секунду мигал бы пустым списком до первого
 * ответа list_llm_models.
 */
function ModelSelect({
  models,
  isLoading,
  defaultModel,
  selectedModel,
  onChange,
}: {
  models: { name: string }[]
  isLoading: boolean
  defaultModel: string | null
  selectedModel: string | null
  onChange: (model: string | null) => void
}) {
  const notYetLoaded = models.length === 0

  if (notYetLoaded) {
    return (
      <select
        disabled
        className="text-xs bg-surface-1 border border-border-subtle rounded px-1.5 py-1 text-text-tertiary"
      >
        <option>{isLoading ? 'Loading models…' : (defaultModel ?? '—')}</option>
      </select>
    )
  }

  return (
    <select
      value={selectedModel ?? ''}
      onChange={(e) => onChange(e.target.value || null)}
      className="text-xs bg-surface-1 border border-border-subtle rounded px-1.5 py-1 text-text-secondary focus:outline-none focus:border-accent"
    >
      {/* Пустое значение = "использовать дефолт провайдера" — тот же
       *  смысл, что и не передавать 'model' в ai_chat вовсе. */}
      <option value="">
        {defaultModel ? `Default (${defaultModel})` : 'Default'}
      </option>
      {models.map((m) => (
        <option key={m.name} value={m.name}>
          {m.name}
        </option>
      ))}
    </select>
  )
}

/**
 * Interactive chat panel: a human types a prompt, cks-mcp's ai_chat tool
 * decides which of its ~60 tools to call, and the graph tab updates live
 * (ADR-001). Dumb presentational panel + thin page wrapper, same split as
 * AgentPanel.tsx/AgentsPage.tsx.
 */
export function ChatPanel() {
  const {
    turns,
    isSending,
    error,
    selectedModel,
    send,
    retry,
    continueTruncated,
    clearChat,
  } = useAiChat()
  const setSelectedModel = useChatStore((s) => s.setSelectedModel)
  const { status: llmStatus } = useLLMStatus()
  const {
    models: llmModels,
    isLoading: llmModelsLoading,
    refresh: refreshLLMModels,
  } = useLLMModels()
  const [input, setInput] = useState('')

  // Список моделей относится к текущему провайдеру (list_llm_models
  // резолвит провайдера так же, как get_llm_status) — если провайдер
  // сменился (кто-то поправил env и перезапустил cks-mcp), старый список
  // моделей уже не годится, перезагружаем.
  const llmProvider = llmStatus?.provider
  useEffect(() => {
    if (llmProvider) {
      refreshLLMModels()
    }
    // refreshLLMModels is stable (useCallback with an empty dep array in
    // useLLMModels), so this only re-runs when llmProvider actually changes.
  }, [llmProvider, refreshLLMModels])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const text = input.trim()
    if (!text || isSending) return
    setInput('')
    send(text)
  }

  // Enter отправляет, Shift+Enter вставляет перенос строки — textarea по
  // умолчанию не отправляет форму по Enter, form onSubmit сюда не
  // достучится без явного keydown-хендлера.
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSubmit(e)
    }
  }

  // Автоматически расширяет textarea под содержимое (до max-h-40 из
  // className, дальше появляется собственный скролл) -- сбрасываем
  // высоту перед measurement, иначе scrollHeight никогда не уменьшится
  // при удалении текста.
  const handleInput = (e: React.FormEvent<HTMLTextAreaElement>) => {
    const el = e.currentTarget
    el.style.height = 'auto'
    el.style.height = `${el.scrollHeight}px`
  }

  // The top banner already tells the user "no provider configured, go to
  // Settings" whenever get_llm_status confirms provider === 'none'. If
  // send() then fails for that exact reason, showing the identical
  // message a second time under the form would just be noise.
  const llmBannerAlreadyShown = llmStatus?.provider === 'none'
  const showErrorBanner =
    error &&
    !(error.kind === 'llm_provider_unavailable' && llmBannerAlreadyShown)

  return (
    <div className="h-full flex flex-col">
      <div className="flex items-center gap-3 px-4 py-3 border-b border-border-subtle">
        <h2 className="text-sm font-semibold text-text-primary">Chat</h2>
        <ModelSelect
          models={llmModels}
          isLoading={llmModelsLoading}
          defaultModel={llmStatus?.model ?? null}
          selectedModel={selectedModel}
          onChange={setSelectedModel}
        />
        <span className="text-xs text-text-tertiary">
          Talks to cks-mcp's ai_chat tool, scoped to the connected session.
        </span>
        <button
          type="button"
          onClick={() => {
            if (turns.length === 0) return
            if (
              typeof window !== 'undefined' &&
              !window.confirm("Clear this session's chat history?")
            ) {
              return
            }
            clearChat()
          }}
          disabled={turns.length === 0}
          title="Clear chat history for this session"
          className="ml-auto text-xs bg-surface-2 hover:bg-surface-3 text-text-secondary hover:text-text-primary px-2 py-1 rounded disabled:opacity-40 disabled:cursor-not-allowed"
        >
          Clear chat
        </button>
      </div>

      <LLMStatusBanner status={llmStatus} />

      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {turns.length === 0 && !isSending && (
          <p className="text-xs text-text-tertiary">
            Ask for something — e.g. "add a Person node named Ada Lovelace and
            connect her to the Analytical Engine with a designed relation".
          </p>
        )}
        {turns.map((turn, i) => (
          <TurnBubble
            // biome-ignore lint/suspicious/noArrayIndexKey: turns have no stable id
            key={i}
            turn={turn}
            onContinue={i === turns.length - 1 ? continueTruncated : undefined}
            isSending={isSending}
          />
        ))}
        {isSending && (
          <div className="flex justify-start">
            <div className="rounded-lg px-3 py-2 text-sm bg-surface-1 border border-border-subtle text-text-tertiary">
              thinking…
            </div>
          </div>
        )}
      </div>

      {showErrorBanner && (
        <ChatErrorBanner
          error={error}
          onRetry={
            error.kind === 'llm_call_failed' ||
            error.kind === 'network' ||
            error.kind === 'other'
              ? retry
              : undefined
          }
          isRetrying={isSending}
        />
      )}

      <form
        onSubmit={handleSubmit}
        // A plain border-t on a transparent form let the input area
        // visually merge into the page background (surface-0) — same
        // tone above and below the line, nothing to distinguish "this is
        // where you type". A surface-1 backing plus more padding gives
        // the whole form a floor to sit on, distinct from both the
        // scrollback above and the page behind it.
        //
        // items-center (not items-end): the textarea defaults to 2 rows
        // while the Send button is single-line height, so bottom-aligning
        // left the button riding low against the textarea's baseline
        // instead of sitting level with it. Centering keeps the button
        // level with the input at rest and still reads fine once the
        // textarea grows with handleInput's auto-resize.
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
          <textarea
            rows={2}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onInput={handleInput}
            onKeyDown={handleKeyDown}
            placeholder="Ask cks-mcp to look up, add, or connect something… (Enter to send, Shift+Enter for a new line)"
            disabled={isSending}
            className="w-full bg-surface-2 border border-border rounded pl-8 pr-3 py-2.5 text-sm text-text-primary placeholder-text-tertiary focus:outline-none focus:border-accent disabled:opacity-50 resize-none max-h-40 overflow-y-auto leading-normal"
          />
        </div>
        <button
          type="submit"
          disabled={isSending || !input.trim()}
          className="text-xs bg-accent hover:bg-accent-strong text-white px-3 py-2.5 rounded disabled:opacity-40 disabled:cursor-not-allowed"
        >
          Send
        </button>
      </form>
    </div>
  )
}
