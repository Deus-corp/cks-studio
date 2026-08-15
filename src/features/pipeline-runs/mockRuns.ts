// Copyright (c) 2026 Deus Corp. Licensed under MIT.

import { listPipelineRuns } from '@/services/mcpTools'
import type { PipelineRun } from './types'

/**
 * Loads run history for a session from the real `list_pipeline_runs` MCP
 * tool (see cks-mcp src/cks_mcp/tools/list_pipeline_runs). Kept in this
 * file (rather than renamed) so RunHistoryPanel's import doesn't need to
 * change; the "mock" era of this feature is over now that the backend
 * tool exists -- see git history for the deterministic mock dataset this
 * replaced.
 *
 * The backend can still be unavailable (no cks-mcp server running, no
 * outbox-capable storage backend, etc.) -- RunHistoryPanel already
 * surfaces a thrown error from `load()`, so there is no mock fallback
 * here.
 */
export async function loadPipelineRuns(
  sessionId: string,
): Promise<PipelineRun[]> {
  return listPipelineRuns(sessionId)
}

export const IS_MOCK_DATA = false
