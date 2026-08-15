// Copyright (c) 2026 Deus Corp. Licensed under MIT.

import { MetricsStrip } from '@/features/metrics/MetricsStrip'
import { PipelineMonitor } from '@/features/pipeline-monitor/PipelineMonitor'
import { RunHistoryPanel } from '@/features/pipeline-runs/RunHistoryPanel'

export function PipelinePage() {
  return (
    <div className="h-full flex flex-col">
      <MetricsStrip />
      <div className="flex-1 min-h-0 flex flex-col">
        <div className="flex-1 min-h-0">
          <PipelineMonitor />
        </div>
        <RunHistoryPanel />
      </div>
    </div>
  )
}
