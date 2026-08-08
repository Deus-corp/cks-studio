import { describe, expect, it, vi } from 'vitest'
import { exportGraphAsPng, exportGraphAsSvg } from '../graphExport'

vi.mock('html-to-image', () => ({
  toPng: vi.fn().mockResolvedValue('data:image/png;base64,fake'),
  toSvg: vi.fn().mockResolvedValue('data:image/svg+xml;base64,fake'),
}))

describe('graphExport guard clauses', () => {
  it('rejects PNG export when there are no nodes', async () => {
    await expect(exportGraphAsPng({ nodes: [] })).rejects.toThrow('Граф пуст')
  })

  it('rejects SVG export when there are no nodes', async () => {
    await expect(exportGraphAsSvg({ nodes: [] })).rejects.toThrow('Граф пуст')
  })

  it('rejects export when .react-flow__viewport is not in the DOM', async () => {
    // jsdom document has no react-flow rendered in this test.
    const nodes = [
      {
        id: 'a',
        position: { x: 0, y: 0 },
        data: {},
        width: 220,
        height: 60,
      },
    ]
    await expect(exportGraphAsPng({ nodes })).rejects.toThrow(
      'react-flow__viewport not found',
    )
  })
})
