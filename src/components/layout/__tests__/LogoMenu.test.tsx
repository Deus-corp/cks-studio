// Copyright (c) 2026 Deus Corp. Licensed under MIT.

import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useGraphStore } from '@/features/graph-explorer/graphExplorerStore'
import { usePublishDialogStore } from '@/features/graph-gallery/publishDialogStore'
import { useSessionStore } from '@/services/sessionStore'
import { LogoMenu } from '../LogoMenu'

const { navigateMock } = vi.hoisted(() => ({
  navigateMock: vi.fn(),
}))

vi.mock('react-router-dom', async () => {
  const actual =
    await vi.importActual<typeof import('react-router-dom')>('react-router-dom')
  return {
    ...actual,
    useNavigate: () => navigateMock,
  }
})

const {
  getFullGraphAsJsonMock,
  importGraphFromJsonMock,
  createEmptySessionMock,
} = vi.hoisted(() => ({
  getFullGraphAsJsonMock: vi.fn(),
  importGraphFromJsonMock: vi.fn(),
  createEmptySessionMock: vi.fn(),
}))

vi.mock('@/services/mcpTools', () => ({
  getFullGraphAsJson: getFullGraphAsJsonMock,
  importGraphFromJson: importGraphFromJsonMock,
  createEmptySession: createEmptySessionMock,
}))

const { downloadGraphAsJsonMock } = vi.hoisted(() => ({
  downloadGraphAsJsonMock: vi.fn(),
}))

vi.mock('@/shared/utils/graphExport', () => ({
  downloadGraphAsJson: downloadGraphAsJsonMock,
}))

function renderMenu() {
  return render(
    <MemoryRouter>
      <LogoMenu />
    </MemoryRouter>,
  )
}

function openMenu() {
  fireEvent.click(screen.getByRole('button', { name: /cks studio/i }))
}

beforeEach(() => {
  useSessionStore.setState({ sessionId: '', serverUrl: 'http://localhost' })
  useGraphStore.setState({
    nodes: [{ id: 'n1', position: { x: 0, y: 0 }, data: {} }] as never,
    edges: [{ id: 'e1', source: 'n1', target: 'n1' }] as never,
    selectedNodeId: 'n1',
  })
  usePublishDialogStore.setState({ openRequested: false })
})

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

describe('LogoMenu', () => {
  it('is closed by default and opens the menu on logo click', () => {
    renderMenu()
    expect(screen.queryByRole('menu')).not.toBeInTheDocument()

    openMenu()

    expect(screen.getByRole('menu')).toBeInTheDocument()
    expect(
      screen.getByRole('menuitem', { name: /create graph/i }),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('menuitem', { name: /save graph/i }),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('menuitem', { name: /load graph/i }),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('menuitem', { name: /export graph/i }),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('menuitem', { name: /import graph/i }),
    ).toBeInTheDocument()
  })

  it('closes the menu when clicking outside', () => {
    renderMenu()
    openMenu()
    expect(screen.getByRole('menu')).toBeInTheDocument()

    fireEvent.mouseDown(document.body)

    expect(screen.queryByRole('menu')).not.toBeInTheDocument()
  })

  it('closes the menu on Escape', () => {
    renderMenu()
    openMenu()
    expect(screen.getByRole('menu')).toBeInTheDocument()

    fireEvent.keyDown(document, { key: 'Escape' })

    expect(screen.queryByRole('menu')).not.toBeInTheDocument()
  })

  it('"Create graph" creates a new empty session via validate_knowledge, adopts it, and navigates home', async () => {
    useSessionStore.setState({ sessionId: 'sess-1' })
    createEmptySessionMock.mockResolvedValue({ session_id: 'new-empty-sess' })
    renderMenu()
    openMenu()

    fireEvent.click(screen.getByRole('menuitem', { name: /create graph/i }))

    expect(createEmptySessionMock).toHaveBeenCalled()
    await vi.waitFor(() => {
      expect(useSessionStore.getState().sessionId).toBe('new-empty-sess')
    })
    expect(useGraphStore.getState().nodes).toEqual([])
    expect(useGraphStore.getState().edges).toEqual([])
    expect(useGraphStore.getState().selectedNodeId).toBeNull()
    expect(navigateMock).toHaveBeenCalledWith('/')
  })

  it('"Create graph" shows an inline error and keeps the old session if the backend call fails', async () => {
    useSessionStore.setState({ sessionId: 'sess-1' })
    createEmptySessionMock.mockResolvedValue({
      error: 'server_error',
      message: 'Could not create a new session.',
    })
    renderMenu()
    openMenu()

    fireEvent.click(screen.getByRole('menuitem', { name: /create graph/i }))

    expect(
      await screen.findByText(/could not create a new session/i),
    ).toBeInTheDocument()
    expect(useSessionStore.getState().sessionId).toBe('sess-1')
    expect(navigateMock).not.toHaveBeenCalledWith('/')
  })

  it('"Save graph" requests the publish dialog to open and navigates home', () => {
    renderMenu()
    openMenu()

    fireEvent.click(screen.getByRole('menuitem', { name: /save graph/i }))

    expect(usePublishDialogStore.getState().openRequested).toBe(true)
    expect(navigateMock).toHaveBeenCalledWith('/')
  })

  it('"Load graph" navigates to the gallery', () => {
    renderMenu()
    openMenu()

    fireEvent.click(screen.getByRole('menuitem', { name: /load graph/i }))

    expect(navigateMock).toHaveBeenCalledWith('/gallery')
  })

  it('"Export graph" is disabled when no session is connected', () => {
    useSessionStore.setState({ sessionId: '' })
    renderMenu()
    openMenu()

    expect(
      screen.getByRole('menuitem', { name: /export graph/i }),
    ).toBeDisabled()
    fireEvent.click(screen.getByRole('menuitem', { name: /export graph/i }))
    expect(getFullGraphAsJsonMock).not.toHaveBeenCalled()
  })

  it('"Export graph" downloads the canonical JSON when a session exists', async () => {
    useSessionStore.setState({ sessionId: 'sess-1' })
    getFullGraphAsJsonMock.mockResolvedValue('{"objects":[]}')
    renderMenu()
    openMenu()

    fireEvent.click(screen.getByRole('menuitem', { name: /export graph/i }))

    expect(getFullGraphAsJsonMock).toHaveBeenCalledWith('sess-1')
    await vi.waitFor(() => {
      expect(downloadGraphAsJsonMock).toHaveBeenCalledWith(
        '{"objects":[]}',
        'cks-graph-sess-1.json',
      )
    })
  })

  it('"Import graph" reads a selected JSON file, imports it, and navigates home', async () => {
    importGraphFromJsonMock.mockResolvedValue({ session_id: 'new-sess' })
    renderMenu()
    openMenu()

    fireEvent.click(screen.getByRole('menuitem', { name: /import graph/i }))
    const fileInput = screen.getByLabelText(
      /import graph json file/i,
    ) as HTMLInputElement
    const file = new File(['{"objects":[]}'], 'graph.json', {
      type: 'application/json',
    })
    fireEvent.change(fileInput, { target: { files: [file] } })

    await vi.waitFor(() => {
      expect(importGraphFromJsonMock).toHaveBeenCalledWith('{"objects":[]}')
    })
    await vi.waitFor(() => {
      expect(useSessionStore.getState().sessionId).toBe('new-sess')
    })
    expect(navigateMock).toHaveBeenCalledWith('/')
  })

  it('shows a readable error when import fails', async () => {
    importGraphFromJsonMock.mockResolvedValue({
      error: 'invalid_json',
      message: 'Could not parse the file.',
    })
    renderMenu()
    openMenu()

    fireEvent.click(screen.getByRole('menuitem', { name: /import graph/i }))
    const fileInput = screen.getByLabelText(
      /import graph json file/i,
    ) as HTMLInputElement
    const file = new File(['not json'], 'graph.json', {
      type: 'application/json',
    })
    fireEvent.change(fileInput, { target: { files: [file] } })

    expect(
      await screen.findByText(/could not parse the file/i),
    ).toBeInTheDocument()
    expect(useSessionStore.getState().sessionId).toBe('')
  })
})
