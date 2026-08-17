// Copyright (c) 2026 Deus Corp. Licensed under MIT.

import { useState } from 'react'

/**
 * Lightweight collapsible section used to group related information in
 * panels (currently SidePanel) instead of one long undifferentiated
 * block. Each section toggles independently -- there's no accordion
 * behaviour forcing others closed, since a user inspecting a node after
 * agent activity may want Pipeline and Agent Findings open together.
 */
export function CollapsibleSection({
  title,
  defaultOpen = false,
  children,
}: {
  title: string
  defaultOpen?: boolean
  children: React.ReactNode
}) {
  const [isOpen, setIsOpen] = useState(defaultOpen)

  return (
    <div className="border-t border-border-subtle first:border-t-0">
      <button
        type="button"
        onClick={() => setIsOpen((v) => !v)}
        aria-expanded={isOpen}
        className="w-full flex items-center justify-between py-2 text-left group"
      >
        <span className="text-xs font-semibold uppercase tracking-wide text-text-secondary group-hover:text-text-primary">
          {title}
        </span>
        <span
          className={`text-text-secondary text-[10px] transition-transform ${isOpen ? 'rotate-90' : ''}`}
          aria-hidden="true"
        >
          ▶
        </span>
      </button>
      {isOpen && <div className="pb-3 text-sm">{children}</div>}
    </div>
  )
}
