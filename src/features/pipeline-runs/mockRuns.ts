// Copyright (c) 2026 Deus Corp. Licensed under MIT.

import type { PipelineRun } from './types'

/**
 * Demo/mock — backend connection needed.
 *
 * Deterministic (no Date.now()/Math.random()) so snapshots and tests are
 * stable. Replace loadPipelineRuns()'s body with a real MCP call --
 * something like `await listPipelineRuns(sessionId)` -- once cks-mcp grows
 * a `list_pipeline_runs` tool. See the ADR-007 note in types.ts for why
 * that tool doesn't exist yet.
 */
const MOCK_RUNS: PipelineRun[] = [
  {
    runId: 'run-7f2a9c1e-0001',
    sessionId: 'demo-session',
    status: 'completed',
    startedAt: '2026-08-10T09:12:00Z',
    updatedAt: '2026-08-10T09:18:42Z',
    objectIds: ['obj-101', 'obj-102', 'obj-103'],
    steps: [
      {
        name: 'Researcher',
        status: 'completed',
        startedAt: '2026-08-10T09:12:00Z',
        completedAt: '2026-08-10T09:14:10Z',
      },
      {
        name: 'Synthesizer',
        status: 'completed',
        startedAt: '2026-08-10T09:14:10Z',
        completedAt: '2026-08-10T09:15:55Z',
      },
      {
        name: 'Reviewer',
        status: 'completed',
        startedAt: '2026-08-10T09:15:55Z',
        completedAt: '2026-08-10T09:17:30Z',
      },
      {
        name: 'Arbiter',
        status: 'completed',
        startedAt: '2026-08-10T09:17:30Z',
        completedAt: '2026-08-10T09:18:42Z',
      },
    ],
  },
  {
    runId: 'run-7f2a9c1e-0002',
    sessionId: 'demo-session',
    status: 'running',
    startedAt: '2026-08-11T14:02:00Z',
    updatedAt: '2026-08-11T14:05:20Z',
    objectIds: ['obj-201', 'obj-202'],
    steps: [
      {
        name: 'Researcher',
        status: 'completed',
        startedAt: '2026-08-11T14:02:00Z',
        completedAt: '2026-08-11T14:04:00Z',
      },
      {
        name: 'Synthesizer',
        status: 'active',
        startedAt: '2026-08-11T14:04:00Z',
        completedAt: null,
      },
      {
        name: 'Reviewer',
        status: 'pending',
        startedAt: null,
        completedAt: null,
      },
      {
        name: 'Arbiter',
        status: 'pending',
        startedAt: null,
        completedAt: null,
      },
    ],
  },
  {
    runId: 'run-7f2a9c1e-0003',
    sessionId: 'demo-session',
    status: 'failed',
    startedAt: '2026-08-12T08:30:00Z',
    updatedAt: '2026-08-12T08:33:15Z',
    objectIds: ['obj-301'],
    steps: [
      {
        name: 'Researcher',
        status: 'completed',
        startedAt: '2026-08-12T08:30:00Z',
        completedAt: '2026-08-12T08:31:20Z',
      },
      {
        name: 'Synthesizer',
        status: 'failed',
        startedAt: '2026-08-12T08:31:20Z',
        completedAt: '2026-08-12T08:33:15Z',
        error: 'LLM provider timeout after 3 retries',
        deadLetterTaskId: 42,
      },
      {
        name: 'Reviewer',
        status: 'pending',
        startedAt: null,
        completedAt: null,
      },
      {
        name: 'Arbiter',
        status: 'pending',
        startedAt: null,
        completedAt: null,
      },
    ],
  },
  {
    runId: 'run-7f2a9c1e-0004',
    sessionId: 'demo-session',
    status: 'queued',
    startedAt: '2026-08-13T11:00:00Z',
    updatedAt: '2026-08-13T11:00:00Z',
    objectIds: ['obj-401', 'obj-402', 'obj-403', 'obj-404'],
    steps: [
      {
        name: 'Researcher',
        status: 'pending',
        startedAt: null,
        completedAt: null,
      },
      {
        name: 'Synthesizer',
        status: 'pending',
        startedAt: null,
        completedAt: null,
      },
      {
        name: 'Reviewer',
        status: 'pending',
        startedAt: null,
        completedAt: null,
      },
      {
        name: 'Arbiter',
        status: 'pending',
        startedAt: null,
        completedAt: null,
      },
    ],
  },
]

/**
 * Loads run history for a session.
 *
 * TODO(backend): once cks-mcp exposes `list_pipeline_runs`, replace this
 * with a real call, e.g.:
 *
 *   export async function loadPipelineRuns(sessionId: string): Promise<PipelineRun[]> {
 *     return listPipelineRuns(sessionId) // from '@/services/mcpTools'
 *   }
 *
 * Signature is async on purpose so callers already treat this as I/O, and
 * takes sessionId for the same reason a real list_pipeline_runs call would
 * need it -- the mock dataset itself is not session-scoped, since it exists
 * purely to exercise the UI.
 */
export async function loadPipelineRuns(
  _sessionId: string,
): Promise<PipelineRun[]> {
  return MOCK_RUNS
}

export const IS_MOCK_DATA = true
