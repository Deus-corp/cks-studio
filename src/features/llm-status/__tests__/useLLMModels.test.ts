// Copyright (c) 2026 Deus Corp. Licensed under MIT.

import { act, renderHook, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { LLMModel } from '@/services/mcpTools'
import { useLLMModels } from '../useLLMModels'

const { listLLMModelsMock } = vi.hoisted(() => ({
  listLLMModelsMock: vi.fn(),
}))

vi.mock('@/services/mcpTools', () => ({
  listLLMModels: listLLMModelsMock,
}))

afterEach(() => {
  vi.clearAllMocks()
})

describe('useLLMModels', () => {
  it('fetches models on mount', async () => {
    const models: LLMModel[] = [
      { name: 'llama3.2:latest' },
      { name: 'mistral:latest' },
    ]
    listLLMModelsMock.mockResolvedValue(models)

    const { result } = renderHook(() => useLLMModels())

    expect(result.current.isLoading).toBe(true)

    await waitFor(() => expect(result.current.isLoading).toBe(false))

    expect(result.current.models).toEqual(models)
    expect(result.current.error).toBeNull()
    expect(listLLMModelsMock).toHaveBeenCalledTimes(1)
  })

  it('surfaces a rejected fetch as an error, keeping models empty', async () => {
    listLLMModelsMock.mockRejectedValue(new Error('boom'))

    const { result } = renderHook(() => useLLMModels())

    await waitFor(() => expect(result.current.isLoading).toBe(false))

    expect(result.current.models).toEqual([])
    expect(result.current.error).toBe('boom')
  })

  it('refresh() re-fetches and replaces the model list', async () => {
    listLLMModelsMock.mockResolvedValueOnce([{ name: 'llama3.2:latest' }])
    const { result } = renderHook(() => useLLMModels())
    await waitFor(() => expect(result.current.isLoading).toBe(false))
    expect(result.current.models).toEqual([{ name: 'llama3.2:latest' }])

    listLLMModelsMock.mockResolvedValueOnce([{ name: 'mistral:latest' }])
    await act(async () => {
      await result.current.refresh()
    })

    expect(result.current.models).toEqual([{ name: 'mistral:latest' }])
    expect(listLLMModelsMock).toHaveBeenCalledTimes(2)
  })

  it('ignores a stale in-flight response that resolves after a newer refresh', async () => {
    let resolveFirst!: (models: LLMModel[]) => void
    const firstCall = new Promise<LLMModel[]>((resolve) => {
      resolveFirst = resolve
    })
    listLLMModelsMock.mockReturnValueOnce(firstCall)

    const { result } = renderHook(() => useLLMModels())

    listLLMModelsMock.mockResolvedValueOnce([{ name: 'second' }])
    await act(async () => {
      await result.current.refresh()
    })
    expect(result.current.models).toEqual([{ name: 'second' }])

    // The first (now-stale) request finally resolves -- must not clobber
    // the newer result already applied above.
    await act(async () => {
      resolveFirst([{ name: 'first-stale' }])
      await Promise.resolve()
    })

    expect(result.current.models).toEqual([{ name: 'second' }])
  })
})
