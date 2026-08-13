// Copyright (c) 2026 Deus Corp. Licensed under MIT.

import { DeadLetterPanel } from '@/features/dead-letter/DeadLetterPanel'

export function DeadLetterPage() {
  return (
    <div className="h-full flex flex-col">
      <DeadLetterPanel />
    </div>
  )
}
