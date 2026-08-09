// Copyright (c) 2026 Deus Corp. Licensed under MIT.

import { PipelineMonitor } from '@/features/pipeline-monitor/PipelineMonitor'

export function PipelinePage() {
  return (
    <div className="h-full flex flex-col">
      <PipelineMonitor />
    </div>
  )
}
