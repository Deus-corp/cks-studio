// Copyright (c) 2026 Deus Corp. Licensed under MIT.

import { useEffect, useId, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useGraphStore } from '@/features/graph-explorer/graphExplorerStore'
import { usePublishDialogStore } from '@/features/graph-gallery/publishDialogStore'
import {
  getFullGraphAsJson,
  type ImportGraphError,
  importGraphFromJson,
} from '@/services/mcpTools'
import { useSessionStore } from '@/services/sessionStore'
import { downloadGraphAsJson } from '@/shared/utils/graphExport'

function isImportError(
  result: { session_id: string } | ImportGraphError,
): result is ImportGraphError {
  return 'error' in result
}

/**
 * Dropdown opened from the CKS logo in NavBar (App.tsx), the app's
 * "file menu" equivalent: Create/Save/Load/Export/Import graph, the
 * same handful of actions most desktop-style apps put behind clicking
 * the logo/wordmark in the top-left corner.
 *
 * Export/Import here are strictly canonical CKS JSON (serialize_knowledge
 * / validate_knowledge via mcpTools) -- PNG/SVG snapshotting is a
 * different concern that already lives in GraphPage's on-canvas export
 * controls (graphExport.exportGraphAsPng/Svg), which need a mounted
 * ReactFlow canvas that this menu (reachable from any page) doesn't
 * have.
 *
 * Self-contained: reads/writes useSessionStore and useGraphStore
 * directly rather than taking callbacks as props, since every action
 * here is really "do a thing to the app's global state and navigate",
 * not something the trigger (NavBar) needs to know the details of.
 */
export function LogoMenu() {
  const [isOpen, setIsOpen] = useState(false)
  const [exportError, setExportError] = useState<string | null>(null)
  const [importError, setImportError] = useState<string | null>(null)
  const [importMessage, setImportMessage] = useState<string | null>(null)
  const [isImporting, setIsImporting] = useState(false)

  const containerRef = useRef<HTMLDivElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const menuId = useId()

  const navigate = useNavigate()

  const sessionId = useSessionStore((s) => s.sessionId)
  const setSessionId = useSessionStore((s) => s.setSessionId)

  const setNodes = useGraphStore((s) => s.setNodes)
  const setEdges = useGraphStore((s) => s.setEdges)
  const selectNode = useGraphStore((s) => s.selectNode)
  const clearMultiSelect = useGraphStore((s) => s.clearMultiSelect)
  const clearHighlight = useGraphStore((s) => s.clearHighlight)

  const requestOpenPublishDialog = usePublishDialogStore((s) => s.requestOpen)

  // Close on outside click / Escape -- the two standard ways to dismiss
  // a menu without picking an item (see GraphSearchPalette for the same
  // Escape pattern used elsewhere in the app).
  useEffect(() => {
    if (!isOpen) return

    function handlePointerDown(event: MouseEvent) {
      if (!containerRef.current?.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setIsOpen(false)
      }
    }

    document.addEventListener('mousedown', handlePointerDown)
    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('mousedown', handlePointerDown)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [isOpen])

  // Clear transient messages whenever the menu is (re)opened, so a
  // stale error/success from a previous import doesn't linger.
  function openMenu() {
    setExportError(null)
    setImportError(null)
    setImportMessage(null)
    setIsOpen(true)
  }

  function resetGraphState() {
    setNodes([])
    setEdges([])
    selectNode(null)
    clearMultiSelect()
    clearHighlight()
  }

  function handleCreateGraph() {
    setSessionId('')
    resetGraphState()
    navigate('/')
    setIsOpen(false)
  }

  function handleSaveGraph() {
    requestOpenPublishDialog()
    navigate('/')
    setIsOpen(false)
  }

  function handleLoadGraph() {
    navigate('/gallery')
    setIsOpen(false)
  }

  async function handleExportGraph() {
    if (!sessionId.trim()) {
      setExportError('Connect to a session before exporting.')
      return
    }
    setExportError(null)
    try {
      const json = await getFullGraphAsJson(sessionId)
      downloadGraphAsJson(json, `cks-graph-${sessionId}.json`)
      setIsOpen(false)
    } catch (err) {
      setExportError(
        err instanceof Error ? err.message : 'Failed to export graph.',
      )
    }
  }

  function handleImportGraphClick() {
    fileInputRef.current?.click()
  }

  async function handleImportFileChange(
    event: React.ChangeEvent<HTMLInputElement>,
  ) {
    const file = event.target.files?.[0]
    // Reset the input value immediately so selecting the same file again
    // after a failed import still fires a change event.
    event.target.value = ''
    if (!file) return

    setImportError(null)
    setImportMessage(null)
    setIsImporting(true)
    try {
      const text = await file.text()
      const result = await importGraphFromJson(text)
      if (isImportError(result)) {
        setImportError(result.message || result.error)
        return
      }
      setSessionId(result.session_id)
      resetGraphState()
      setImportMessage(`Imported as session ${result.session_id}.`)
      navigate('/')
      setIsOpen(false)
    } catch (err) {
      setImportError(
        err instanceof Error ? err.message : 'Failed to import graph.',
      )
    } finally {
      setIsImporting(false)
    }
  }

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => (isOpen ? setIsOpen(false) : openMenu())}
        aria-haspopup="menu"
        aria-expanded={isOpen}
        aria-controls={menuId}
        className="flex items-center gap-2 text-text-primary font-display font-bold text-sm tracking-tight hover:text-accent-strong transition-colors rounded-md px-1 -mx-1 focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent"
      >
        <LogoMenuMark />
        CKS Studio
        <ChevronDownIcon isOpen={isOpen} />
      </button>

      {isOpen && (
        <div
          id={menuId}
          role="menu"
          aria-label="CKS Studio menu"
          className="absolute left-0 top-[calc(100%+6px)] z-30 w-64 bg-surface-1 border border-border rounded-lg shadow-2xl overflow-hidden py-1"
        >
          <MenuItem label="Create graph" onSelect={handleCreateGraph} />
          <MenuItem label="Save graph" onSelect={handleSaveGraph} />
          <MenuItem label="Load graph" onSelect={handleLoadGraph} />
          <MenuItem
            label="Export graph"
            onSelect={handleExportGraph}
            disabled={!sessionId.trim()}
          />
          <MenuItem
            label="Import graph"
            onSelect={handleImportGraphClick}
            disabled={isImporting}
          />

          {(exportError || importError || importMessage) && (
            <div className="px-3 pt-1.5 pb-1 text-[11px] leading-snug border-t border-border-subtle mt-1">
              {exportError && (
                <p role="alert" className="text-danger">
                  {exportError}
                </p>
              )}
              {importError && (
                <p role="alert" className="text-danger">
                  {importError}
                </p>
              )}
              {importMessage && (
                <p className="text-text-tertiary">{importMessage}</p>
              )}
            </div>
          )}
        </div>
      )}

      <input
        ref={fileInputRef}
        type="file"
        accept="application/json,.json"
        aria-label="Import graph JSON file"
        onChange={handleImportFileChange}
        className="hidden"
      />
    </div>
  )
}

function MenuItem({
  label,
  onSelect,
  disabled = false,
}: {
  label: string
  onSelect: () => void
  disabled?: boolean
}) {
  return (
    <button
      type="button"
      role="menuitem"
      disabled={disabled}
      onClick={onSelect}
      aria-label={label}
      className="w-full text-left px-3 py-1.5 text-xs text-text-secondary hover:bg-surface-2 hover:text-text-primary transition-colors disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-transparent"
    >
      {label}
    </button>
  )
}

function ChevronDownIcon({ isOpen }: { isOpen: boolean }) {
  return (
    <svg
      width="10"
      height="10"
      viewBox="0 0 10 10"
      fill="none"
      aria-hidden="true"
      className={`text-text-tertiary transition-transform ${isOpen ? 'rotate-180' : ''}`}
    >
      <path
        d="M2 3.5L5 6.5L8 3.5"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

/** Same graph-node glyph as App.tsx's LogoMark, duplicated locally so
 *  this component has no dependency on App.tsx internals (App.tsx
 *  imports LogoMenu, not the other way around). */
function LogoMenuMark() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 18 18"
      fill="none"
      aria-hidden="true"
      className="text-brand-strong"
    >
      <line
        x1="4"
        y1="4"
        x2="14"
        y2="7"
        stroke="currentColor"
        strokeWidth="1.4"
        opacity="0.6"
      />
      <line
        x1="4"
        y1="4"
        x2="8"
        y2="14"
        stroke="currentColor"
        strokeWidth="1.4"
        opacity="0.6"
      />
      <line
        x1="8"
        y1="14"
        x2="14"
        y2="7"
        stroke="currentColor"
        strokeWidth="1.4"
        opacity="0.6"
      />
      <circle cx="4" cy="4" r="2.5" fill="currentColor" />
      <circle cx="14" cy="7" r="2.5" fill="currentColor" />
      <circle cx="8" cy="14" r="2.5" fill="currentColor" />
    </svg>
  )
}
