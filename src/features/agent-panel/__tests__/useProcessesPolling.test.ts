// Copyright (c) 2025 Deus Corp. Licensed under MIT.

import type { ProcessStatus } from '@/services/mcpTools'
import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useProcessesPolling } from '../useProcessesPolling'

const { listProcessesMock } = vi.hoisted(() => ({
  listProcessesMock: vi.fn(),
}))

vi.mock('@/services/mcpTools', () => ({
  listProcesses: listProcessesMock,
}))

/** Flushes pending microtasks (promise resolutions) without touching
 *  fake timers -- `waitFor` polls via real setTimeout internally, which
 *  deadlocks once `vi.useFakeTimers()` is active, so we flush by hand. */
async function flush() {
  await act(async () => {
    await Promise.resolve()
    await Promise.resolve()
  })
}

function makeProcess(overrides: Partial<ProcessStatus> = {}): ProcessStatus {
  return {
    instance_id: 'inst-1',
    process_kind: 'critic',
    hostname: 'host-a',
    pid: 123,
    liveness_interval_s: 30,
    started_at: new Date().toISOString(),
    last_heartbeat_at: new Date().toISOString(),
    current_task_id: null,
    current_task_type: null,
    status: 'alive',
    ...overrides,
  }
}

describe('useProcessesPolling', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    listProcessesMock.mockReset()
    Object.defineProperty(document, 'visibilityState', {
      configurable: true,
      get: () => 'visible',
    })
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('fetches processes on mount', async () => {
    const proc = makeProcess()
    listProcessesMock.mockResolvedValue({ processes: [proc] })

    const { result } = renderHook(() => useProcessesPolling())
    await flush()

    expect(result.current.processes).toEqual([proc])
    expect(listProcessesMock).toHaveBeenCalledTimes(1)
    expect(result.current.error).toBeNull()
    expect(result.current.lastFetchedAt).not.toBeNull()
  })

  it('surfaces network errors without fabricating data', async () => {
    listProcessesMock.mockRejectedValue(new Error('boom'))

    const { result } = renderHook(() => useProcessesPolling())
    await flush()

    expect(result.current.error).toBe('boom')
    expect(result.current.processes).toEqual([])
  })

  it('polls again after intervalMs elapses', async () => {
    listProcessesMock.mockResolvedValue({ processes: [] })

    renderHook(() => useProcessesPolling(5_000))
    await flush()
    expect(listProcessesMock).toHaveBeenCalledTimes(1)

    await act(async () => {
      await vi.advanceTimersByTimeAsync(5_000)
    })

    expect(listProcessesMock).toHaveBeenCalledTimes(2)
  })

  it('pauses polling while the tab is hidden and resumes when visible again', async () => {
    listProcessesMock.mockResolvedValue({ processes: [] })

    renderHook(() => useProcessesPolling(5_000))
    await flush()
    expect(listProcessesMock).toHaveBeenCalledTimes(1)

    Object.defineProperty(document, 'visibilityState', {
      configurable: true,
      get: () => 'hidden',
    })
    act(() => {
      document.dispatchEvent(new Event('visibilitychange'))
    })

    await act(async () => {
      await vi.advanceTimersByTimeAsync(20_000)
    })
    // Still just the initial fetch -- no polling while hidden.
    expect(listProcessesMock).toHaveBeenCalledTimes(1)

    Object.defineProperty(document, 'visibilityState', {
      configurable: true,
      get: () => 'visible',
    })
    act(() => {
      document.dispatchEvent(new Event('visibilitychange'))
    })
    await flush()

    expect(listProcessesMock).toHaveBeenCalledTimes(2)
  })

  it('refresh() re-fetches on demand', async () => {
    listProcessesMock.mockResolvedValue({ processes: [] })

    const { result } = renderHook(() => useProcessesPolling())
    await flush()
    expect(listProcessesMock).toHaveBeenCalledTimes(1)

    await act(async () => {
      await result.current.refresh()
    })

    expect(listProcessesMock).toHaveBeenCalledTimes(2)
  })

  it('ignores a stale in-flight response that resolves after a newer one', async () => {
    let resolveFirst: (v: { processes: ProcessStatus[] }) => void = () => {}
    const first = new Promise<{ processes: ProcessStatus[] }>((res) => {
      resolveFirst = res
    })
    const staleProc = makeProcess({ instance_id: 'stale' })
    const freshProc = makeProcess({ instance_id: 'fresh' })

    listProcessesMock
      .mockImplementationOnce(() => first)
      .mockResolvedValueOnce({ processes: [freshProc] })

    const { result } = renderHook(() => useProcessesPolling())

    // Trigger the second (fresh) request before the first resolves.
    await act(async () => {
      await result.current.refresh()
    })

    expect(result.current.processes).toEqual([freshProc])

    // Now let the stale first request resolve -- it must not overwrite
    // the newer state.
    await act(async () => {
      resolveFirst({ processes: [staleProc] })
      await Promise.resolve()
    })

    expect(result.current.processes).toEqual([freshProc])
  })
})
