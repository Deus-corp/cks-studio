// Copyright (c) 2026 Deus Corp. Licensed under MIT.

import { useCallback, useEffect, useState } from 'react'
import {
  approveResolution,
  type DeadLetterReviewError,
  type DeadLetterTask,
  type ReviewDeadLetterResult,
  rejectResolution,
  reviewDeadLetter,
} from '@/services/mcpTools'
import { useSessionStore } from '@/services/sessionStore'
import { useSettingsStore } from '@/shared/stores/settingsStore'
import { useDeadLetterPolling } from './useDeadLetterPolling'

const MAX_SNIPPET_LENGTH = 90

function payloadSnippet(payload: Record<string, unknown>): string {
  const text = JSON.stringify(payload)
  return text.length <= MAX_SNIPPET_LENGTH
    ? text
    : `${text.slice(0, MAX_SNIPPET_LENGTH)}…`
}

function isReviewError(
  result: ReviewDeadLetterResult | DeadLetterReviewError,
): result is DeadLetterReviewError {
  return 'error' in result && !('proposed_resolution' in result)
}

interface TaskRowProps {
  task: DeadLetterTask
  isSelected: boolean
  onSelect: (taskId: number) => void
}

function TaskRow({ task, isSelected, onSelect }: TaskRowProps) {
  return (
    <button
      type="button"
      onClick={() => onSelect(task.task_id)}
      aria-current={isSelected ? 'true' : undefined}
      className={`w-full text-left px-3 py-2.5 border-b border-border-subtle transition-colors ${
        isSelected ? 'bg-surface-2' : 'hover:bg-surface-2/60'
      }`}
    >
      <div className="flex items-center gap-2">
        <span className="text-sm font-medium text-text-primary">
          #{task.task_id}
        </span>
        <span className="text-xs bg-surface-3 text-text-secondary px-1.5 py-0.5 rounded">
          {task.task_type}
        </span>
        {task.retry_count > 0 && (
          <span className="ml-auto text-xs text-text-tertiary">
            {task.retry_count} retr{task.retry_count === 1 ? 'y' : 'ies'}
          </span>
        )}
      </div>
      <div className="text-xs text-text-tertiary truncate mt-0.5">
        session: {task.session_id}
      </div>
      <div className="text-xs text-text-secondary truncate mt-0.5">
        {payloadSnippet(task.payload)}
      </div>
    </button>
  )
}

/**
 * Detail + approve/reject panel for a single dead-lettered task, driven
 * by review_dead_letter's proposed_resolution (see mcpTools.ts). Mirrors
 * AgentPanel's card-with-inline-action-state pattern (agent-panel/
 * AgentPanel.tsx) rather than a modal, since the studio doesn't otherwise
 * use modals for this kind of review-then-act flow.
 */
function TaskDetail({
  taskId,
  onResolved,
}: {
  taskId: number
  onResolved: () => void
}) {
  const [review, setReview] = useState<
    ReviewDeadLetterResult | DeadLetterReviewError | null
  >(null)
  const [isLoadingReview, setIsLoadingReview] = useState(false)
  const [reviewError, setReviewError] = useState<string | null>(null)
  const [isActing, setIsActing] = useState(false)
  const [actionError, setActionError] = useState<string | null>(null)
  const [rejectReason, setRejectReason] = useState('')
  const [showRejectInput, setShowRejectInput] = useState(false)

  // Parent remounts this component via key={taskId} (see DeadLetterPanel),
  // so a plain mount-effect is enough to fire whenever the selected task
  // changes -- no separate "did we already load this id" tracking needed.
  const load = useCallback(async () => {
    setIsLoadingReview(true)
    setReviewError(null)
    try {
      const result = await reviewDeadLetter(taskId)
      setReview(result)
    } catch (e) {
      setReviewError(e instanceof Error ? e.message : 'Unknown error')
    } finally {
      setIsLoadingReview(false)
    }
  }, [taskId])

  useEffect(() => {
    load()
  }, [load])

  const handleApprove = async () => {
    if (!review || isReviewError(review)) return
    const { proposed_resolution } = review
    if (proposed_resolution.error || !proposed_resolution.tool) return
    setIsActing(true)
    setActionError(null)
    try {
      const result = await approveResolution(taskId, {
        tool: proposed_resolution.tool,
        arguments: proposed_resolution.arguments,
      })
      if (!result.approved) {
        setActionError(
          result.message ??
            'Resolution was not successful — task remains DEAD.',
        )
        return
      }
      onResolved()
    } catch (e) {
      setActionError(e instanceof Error ? e.message : 'Unknown error')
    } finally {
      setIsActing(false)
    }
  }

  const handleReject = async () => {
    setIsActing(true)
    setActionError(null)
    try {
      const result = await rejectResolution(
        taskId,
        rejectReason.trim() || undefined,
      )
      if (!result.rejected) {
        setActionError(result.message ?? 'Reject failed.')
        return
      }
      onResolved()
    } catch (e) {
      setActionError(e instanceof Error ? e.message : 'Unknown error')
    } finally {
      setIsActing(false)
      setShowRejectInput(false)
      setRejectReason('')
    }
  }

  if (isLoadingReview) {
    return <p className="text-xs text-text-tertiary p-4">Loading task…</p>
  }

  if (reviewError) {
    return (
      <div className="p-4 space-y-2">
        <p className="text-danger text-xs">{reviewError}</p>
        <button
          type="button"
          onClick={load}
          className="text-xs bg-surface-2 hover:bg-surface-3 text-text-primary px-2 py-1 rounded"
        >
          Retry
        </button>
      </div>
    )
  }

  if (!review) return null

  if (isReviewError(review)) {
    return (
      <div className="p-4">
        <p className="text-danger text-xs">{review.message}</p>
      </div>
    )
  }

  const { proposed_resolution } = review
  const canApprove =
    !proposed_resolution.error && Boolean(proposed_resolution.tool)

  return (
    <div className="p-4 space-y-3 overflow-y-auto">
      <div>
        <h3 className="text-sm font-semibold text-text-primary">
          Task #{review.task_id}
        </h3>
        <p className="text-xs text-text-tertiary">
          {review.task_type} · session {review.session_id} ·{' '}
          {review.retry_count} retr{review.retry_count === 1 ? 'y' : 'ies'}
        </p>
      </div>

      {review.last_error && (
        <div>
          <p className="text-xs font-medium text-text-secondary mb-1">
            Last error
          </p>
          <p className="text-xs text-danger break-words bg-danger/10 border border-danger/30 rounded p-2">
            {review.last_error}
          </p>
        </div>
      )}

      <div>
        <p className="text-xs font-medium text-text-secondary mb-1">Payload</p>
        <pre className="text-xs text-text-secondary bg-surface-2 border border-border-subtle rounded p-2 overflow-x-auto whitespace-pre-wrap break-words">
          {JSON.stringify(review.payload, null, 2)}
        </pre>
      </div>

      <div>
        <p className="text-xs font-medium text-text-secondary mb-1">
          Proposed resolution
        </p>
        {proposed_resolution.error ? (
          <p className="text-xs text-text-tertiary bg-surface-2 border border-border-subtle rounded p-2">
            No resolution could be proposed: {proposed_resolution.message}
          </p>
        ) : (
          <pre className="text-xs text-text-secondary bg-surface-2 border border-border-subtle rounded p-2 overflow-x-auto whitespace-pre-wrap break-words">
            {JSON.stringify(
              {
                tool: proposed_resolution.tool,
                arguments: proposed_resolution.arguments,
              },
              null,
              2,
            )}
          </pre>
        )}
      </div>

      {actionError && (
        <p className="text-xs text-danger break-words">{actionError}</p>
      )}

      <div className="flex gap-2 pt-1">
        <button
          type="button"
          onClick={handleApprove}
          disabled={isActing || !canApprove}
          title={
            canApprove ? undefined : 'No resolution to apply for this task'
          }
          className="flex-1 text-xs bg-brand hover:bg-brand-strong text-brand-text px-3 py-1.5 rounded disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {isActing ? '…' : 'Approve'}
        </button>
        <button
          type="button"
          onClick={() => setShowRejectInput((v) => !v)}
          disabled={isActing}
          className="flex-1 text-xs bg-red-900 hover:bg-red-800 text-red-200 px-3 py-1.5 rounded disabled:opacity-40 disabled:cursor-not-allowed"
        >
          Reject
        </button>
      </div>

      {showRejectInput && (
        <div className="space-y-1.5">
          <input
            type="text"
            value={rejectReason}
            onChange={(e) => setRejectReason(e.target.value)}
            placeholder="Reason (optional)"
            className="w-full bg-surface-2 border border-border rounded px-2 py-1 text-xs text-text-primary placeholder:text-text-tertiary"
          />
          <button
            type="button"
            onClick={handleReject}
            disabled={isActing}
            className="w-full text-xs bg-red-900 hover:bg-red-800 text-red-200 px-3 py-1.5 rounded disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {isActing ? '…' : 'Confirm reject'}
          </button>
        </div>
      )}
    </div>
  )
}

/**
 * Dead Letter inbox: list of conflict tasks a Critic agent permanently
 * gave up on (list_dead_lettered_conflicts), with a detail + approve/
 * reject panel per task (review_dead_letter / approve_resolution /
 * reject_resolution). Layout mirrors AgentPanel's header-plus-scroll-area
 * shape; list+detail split is new to this page (nothing else in the
 * studio currently needs it).
 */
export function DeadLetterPanel() {
  const pollingIntervalMs = useSettingsStore((s) => s.pollingIntervalMs)
  const connectedSessionId = useSessionStore((s) => s.sessionId)
  // Defaults to filtering by the currently connected session -- the
  // reported bug was tasks from *other* sessions showing up unlabelled
  // in what the user expected to be a current-session view. Toggling
  // this off falls back to the unfiltered (all-sessions) list.
  const [filterToCurrentSession, setFilterToCurrentSession] = useState(true)
  const sessionFilter =
    filterToCurrentSession && connectedSessionId.trim()
      ? connectedSessionId.trim()
      : undefined
  const { tasks, supported, lastFetchedAt, error, isLoading, refresh } =
    useDeadLetterPolling(pollingIntervalMs, sessionFilter)
  const [selectedTaskId, setSelectedTaskId] = useState<number | null>(null)

  const handleResolved = () => {
    setSelectedTaskId(null)
    refresh()
  }

  return (
    <div className="h-full flex flex-col">
      <div className="flex items-center gap-3 px-4 py-3 border-b border-border-subtle">
        <h2 className="text-sm font-semibold text-text-primary">
          Dead Letter Inbox
        </h2>
        <span className="text-xs text-text-tertiary">
          {lastFetchedAt
            ? `updated ${new Intl.DateTimeFormat(undefined, {
                hour: '2-digit',
                minute: '2-digit',
                second: '2-digit',
              }).format(lastFetchedAt)}`
            : 'loading…'}
        </span>
        <button
          type="button"
          onClick={refresh}
          disabled={isLoading}
          className="ml-auto text-xs bg-surface-2 hover:bg-surface-3 text-text-primary px-2 py-1 rounded disabled:opacity-50"
        >
          {isLoading ? 'Refreshing…' : 'Refresh'}
        </button>
      </div>

      <div className="flex items-center justify-between gap-2 px-4 py-2">
        <p className="text-xs text-text-tertiary">
          Conflict tasks a Critic agent gave up on, for manual review and
          resolution (see review_dead_letter / approve_resolution /
          reject_resolution).
        </p>
        <label className="flex items-center gap-1.5 text-xs text-text-secondary whitespace-nowrap">
          <input
            type="checkbox"
            checked={filterToCurrentSession}
            onChange={(e) => setFilterToCurrentSession(e.target.checked)}
            disabled={!connectedSessionId.trim()}
          />
          Current session only
        </label>
      </div>
      {filterToCurrentSession && connectedSessionId.trim() && (
        <p className="text-xs text-text-tertiary px-4 pb-2 -mt-1 truncate">
          Filtering to session: {connectedSessionId.trim()}
        </p>
      )}

      {error && (
        <p className="text-danger text-xs px-4 py-2">
          Failed to fetch dead-lettered tasks: {error}
        </p>
      )}

      {!error && !supported && (
        <p className="text-xs text-text-tertiary px-4 py-2">
          The connected storage backend doesn't support the persistent outbox
          (e.g. the default in-memory backend) — there is no dead-letter queue
          to show.
        </p>
      )}

      {!error && supported && tasks.length === 0 && !isLoading && (
        <p className="text-xs text-text-tertiary px-4 py-2">
          No dead-lettered tasks — nothing needs review right now.
        </p>
      )}

      <div className="flex-1 flex min-h-0">
        <div className="w-80 border-r border-border-subtle overflow-y-auto">
          {(tasks ?? []).map((task) => (
            <TaskRow
              key={task.task_id}
              task={task}
              isSelected={task.task_id === selectedTaskId}
              onSelect={setSelectedTaskId}
            />
          ))}
        </div>
        <div className="flex-1 overflow-y-auto">
          {selectedTaskId === null ? (
            <p className="text-xs text-text-tertiary p-4">
              Select a task to view its proposed resolution.
            </p>
          ) : (
            <TaskDetail
              key={selectedTaskId}
              taskId={selectedTaskId}
              onResolved={handleResolved}
            />
          )}
        </div>
      </div>
    </div>
  )
}
