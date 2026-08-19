// Copyright (c) 2026 Deus Corp. Licensed under MIT.

import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { DemoAgentsPage } from '../DemoAgentsPage'
import { DemoChatPage } from '../DemoChatPage'
import { DemoDiffPage } from '../DemoDiffPage'
import { DemoGalleryPage } from '../DemoGalleryPage'
import { DemoPipelinePage } from '../DemoPipelinePage'
import { DemoSettingsPage } from '../DemoSettingsPage'
import { DemoToastProvider } from '../DemoToast'

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

describe('DemoGalleryPage', () => {
  it('renders the bundled ecosystem card plus example cards', () => {
    render(
      <MemoryRouter>
        <DemoToastProvider>
          <DemoGalleryPage />
        </DemoToastProvider>
      </MemoryRouter>,
    )
    expect(screen.getByText('cks-ecosystem')).toBeInTheDocument()
    expect(screen.getByText('water-cycle')).toBeInTheDocument()
    expect(screen.getByText('neural-networks-101')).toBeInTheDocument()
  })

  it('shows a "demo only" toast when opening a non-functional card', () => {
    render(
      <MemoryRouter>
        <DemoToastProvider>
          <DemoGalleryPage />
        </DemoToastProvider>
      </MemoryRouter>,
    )
    const openButtons = screen.getAllByRole('button', { name: 'Open in Graph' })
    // Card order matches CARDS: [cks-ecosystem, water-cycle, ...] -- the
    // second button belongs to the non-functional water-cycle card.
    fireEvent.click(openButtons[1])
    expect(screen.getByRole('status')).toHaveTextContent('Demo only')
  })
})

describe('DemoAgentsPage', () => {
  it('lists all seven sweepers and the standalone processes', () => {
    render(<DemoAgentsPage />)
    for (const id of [
      'contradiction',
      'inference_staleness',
      'provenance_staleness',
      'temporal_staleness',
      'graph_freshness',
      'graph_auto_update',
      'graph_health',
    ]) {
      expect(screen.getByText(id)).toBeInTheDocument()
    }
    expect(screen.getByText('critic')).toBeInTheDocument()
    expect(screen.getByText('enrichment')).toBeInTheDocument()
    expect(screen.getByText('fork_resolution')).toBeInTheDocument()
    expect(screen.getByText('pipeline')).toBeInTheDocument()
  })
})

describe('DemoChatPage', () => {
  it('renders a sample conversation with a disabled input', () => {
    render(<DemoChatPage />)
    expect(
      screen.getByText(/What is cks-mcp and how does it relate/),
    ).toBeInTheDocument()
    expect(
      screen.getByPlaceholderText(/Demo only — connect to cks-mcp/),
    ).toBeDisabled()
  })
})

describe('DemoSettingsPage', () => {
  it('lists component versions read from the bundled graph', () => {
    render(<DemoSettingsPage />)
    expect(screen.getByText('cks-core')).toBeInTheDocument()
    // Pulled live from the bundled cks-ecosystem graph
    // (scripts/cks-ecosystem.json) -- currently v1.23.0.
    expect(screen.getByText('v1.23.0')).toBeInTheDocument()
    expect(screen.getByText('cks-studio')).toBeInTheDocument()
  })

  it('switches theme when a selector option is clicked', () => {
    render(<DemoSettingsPage />)
    fireEvent.click(screen.getByRole('button', { name: 'Light' }))
    expect(document.documentElement.getAttribute('data-theme')).toBe('light')
    fireEvent.click(screen.getByRole('button', { name: 'Dark' }))
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark')
  })

  it('copies the Ollama setup snippet to the clipboard', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined)
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText },
      configurable: true,
    })

    render(<DemoSettingsPage />)
    fireEvent.click(screen.getByRole('button', { name: /Copy Ollama setup/ }))

    expect(writeText).toHaveBeenCalledWith(
      expect.stringContaining('CKS_LLM_PROVIDER=ollama'),
    )
    expect(await screen.findByText('Copied')).toBeInTheDocument()
  })
})

describe('DemoPipelinePage', () => {
  it('renders all four active pipeline stage columns', () => {
    render(<DemoPipelinePage />)
    expect(screen.getByText('Awaiting Research')).toBeInTheDocument()
    expect(screen.getByText('Awaiting Review')).toBeInTheDocument()
    expect(screen.getByText('Needs Research')).toBeInTheDocument()
    expect(screen.getByText('Resolved')).toBeInTheDocument()
  })

  it('shows mock cards derived from the bundled graph', () => {
    render(<DemoPipelinePage />)
    expect(screen.getByText('cks-core')).toBeInTheDocument()
    expect(screen.getByText('cks-runtime')).toBeInTheDocument()
  })

  it('shows the demo data banner', () => {
    render(<DemoPipelinePage />)
    expect(
      screen.getByText(/Demo data — connect a live server/),
    ).toBeInTheDocument()
  })
})

describe('DemoDiffPage', () => {
  it('renders an added, a removed and a modified entry', () => {
    render(<DemoDiffPage />)
    expect(screen.getByText(/cks-analytics/)).toBeInTheDocument()
    expect(screen.getByText(/cks-runtime/)).toBeInTheDocument()
    expect(screen.getByText(/cks-core/)).toBeInTheDocument()
    expect(screen.getByText('v1.22.0')).toBeInTheDocument()
  })

  it('shows count badges for each change type', () => {
    render(<DemoDiffPage />)
    expect(screen.getByText('Added: 1')).toBeInTheDocument()
    expect(screen.getByText('Removed: 1')).toBeInTheDocument()
    expect(screen.getByText('Modified: 1')).toBeInTheDocument()
  })

  it('shows the demo diff banner', () => {
    render(<DemoDiffPage />)
    expect(
      screen.getByText(/Demo diff — connect a live server/),
    ).toBeInTheDocument()
  })
})
