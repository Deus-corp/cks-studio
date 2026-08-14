// Copyright (c) 2026 Deus Corp. Licensed under MIT.

import { listDemoGraphObjects } from '@/services/mockClient'
import { STATUS_COLORS, STATUS_LABELS } from '@/shared/constants/colors'
import {
  ACTIVE_PIPELINE_STATUSES,
  type PipelineStatus,
  type TransitionLogEntry,
} from '@/shared/types/pipeline'

interface DemoPipelineCard {
  id: string
  name: string
  type: string
  status: PipelineStatus
  transition: TransitionLogEntry
}

const AGENTS = ['Researcher', 'Reviewer'] as const

/** Deterministic mock transition log entry for a card -- derived from the
 *  object's id/index rather than random, so the page renders the same
 *  content on every load (and in tests). */
function mockTransition(
  index: number,
  status: PipelineStatus,
): TransitionLogEntry {
  const agent = AGENTS[index % AGENTS.length]
  // Spread timestamps a few minutes apart, most recent first in spirit --
  // exact values don't matter, only that they're stable and plausible.
  const minutesAgo = (index % 12) * 7 + 3
  const timestamp = new Date(
    Date.UTC(2026, 0, 12, 9, 0, 0) - minutesAgo * 60_000,
  ).toISOString()
  return {
    timestamp,
    agent,
    action: agent === 'Researcher' ? 'gathered_evidence' : 'reviewed_claim',
    transitioned_to: status,
    reasoning_node_id: null,
  }
}

/** Picks 8-12 objects from the bundled ecosystem graph and assigns each
 *  a pipeline stage by index, so the board always shows a plausible
 *  spread across all four active statuses without any randomness. */
function buildDemoCards(): DemoPipelineCard[] {
  const objects = listDemoGraphObjects().slice(0, 12)
  return objects.map((obj, index) => {
    const status =
      ACTIVE_PIPELINE_STATUSES[index % ACTIVE_PIPELINE_STATUSES.length]
    return {
      id: obj.identity.id,
      name: obj.identity.name || obj.identity.id,
      type: obj.identity.type,
      status,
      transition: mockTransition(index, status),
    }
  })
}

const DEMO_CARDS = buildDemoCards()

function formatTimestamp(iso: string): string {
  try {
    return new Date(iso).toLocaleString(undefined, {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  } catch {
    return iso
  }
}

/**
 * Static stand-in for PipelineMonitor (which normally polls
 * serialize_knowledge against a live cks-mcp session for
 * current_status/transition_log). Cards here are derived deterministically
 * from the bundled ecosystem graph -- no polling, no MCP calls.
 */
export function DemoPipelinePage() {
  const grouped = new Map<PipelineStatus, DemoPipelineCard[]>()
  for (const status of ACTIVE_PIPELINE_STATUSES) {
    grouped.set(status, [])
  }
  for (const card of DEMO_CARDS) {
    grouped.get(card.status)?.push(card)
  }

  return (
    <div className="h-full flex flex-col">
      <div className="flex items-center gap-3 px-4 py-3 border-b border-border-subtle">
        <h2 className="text-sm font-semibold text-text-primary">
          Pipeline Monitor
        </h2>
        <span className="text-xs text-text-tertiary">
          Demo data — connect a live server to run real pipelines.
        </span>
      </div>

      <div className="flex-1 flex gap-3 overflow-x-auto p-4">
        {ACTIVE_PIPELINE_STATUSES.map((status) => {
          const items = grouped.get(status) ?? []
          return (
            <div
              key={status}
              data-testid={`pipeline-column-${status}`}
              className="flex-shrink-0 w-56 bg-surface-1 border border-border-subtle rounded flex flex-col"
            >
              <div
                className="px-3 py-2 text-xs font-medium border-b border-border-subtle flex items-center gap-2"
                style={{ color: STATUS_COLORS[status] }}
              >
                <span
                  className="w-2 h-2 rounded-full inline-block"
                  style={{ backgroundColor: STATUS_COLORS[status] }}
                />
                {STATUS_LABELS[status]}
                <span className="ml-auto text-text-tertiary">
                  {items.length}
                </span>
              </div>
              <div className="flex-1 overflow-y-auto p-2 space-y-2">
                {items.map((card) => (
                  <div
                    key={card.id}
                    className="w-full text-left text-xs bg-surface-2 rounded px-2 py-1.5 border border-transparent"
                  >
                    <div className="font-medium text-text-primary truncate">
                      {card.name}
                    </div>
                    <div className="text-text-tertiary">{card.type}</div>
                    <div className="mt-1 text-[10px] text-text-tertiary flex flex-col gap-0.5">
                      <span>{formatTimestamp(card.transition.timestamp)}</span>
                      <span>
                        {card.transition.agent} · {card.transition.action}
                      </span>
                    </div>
                  </div>
                ))}
                {items.length === 0 && (
                  <p className="text-[10px] text-text-tertiary px-1">
                    No demo objects in this stage.
                  </p>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
