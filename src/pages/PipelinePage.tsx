// Copyright (c) 2026 Deus Corp. Licensed under MIT.

import { MetricsStrip } from '@/features/metrics/MetricsStrip'
import { PipelineMonitor } from '@/features/pipeline-monitor/PipelineMonitor'

export function PipelinePage() {
  return (
    <div className="h-full flex flex-col">
      <MetricsStrip />
      <div className="flex-1 min-h-0">
        <PipelineMonitor />
      </div>
    </div>
  )
}
