// Copyright (c) 2026 Deus Corp. Licensed under MIT.

import { AgentPanel } from '@/features/agent-panel/AgentPanel'
import { MetricsStrip } from '@/features/metrics/MetricsStrip'

export function AgentsPage() {
  return (
    <div className="h-full flex flex-col">
      <MetricsStrip />
      <div className="flex-1 min-h-0">
        <AgentPanel />
      </div>
    </div>
  )
}
