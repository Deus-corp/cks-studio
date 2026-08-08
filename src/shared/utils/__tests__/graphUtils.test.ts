import type { Edge } from '@xyflow/react'
import { describe, expect, it } from 'vitest'
import { findPathBetweenNodes } from '../graphUtils'

function edge(id: string, source: string, target: string): Edge {
  return { id, source, target }
}

describe('findPathBetweenNodes', () => {
  it('returns empty set when fromId === toId', () => {
    const edges = [edge('e1', 'a', 'b')]
    expect(findPathBetweenNodes('a', 'a', edges)).toEqual(new Set())
  })

  it('finds a direct edge between two connected nodes', () => {
    const edges = [edge('e1', 'a', 'b')]
    expect(findPathBetweenNodes('a', 'b', edges)).toEqual(new Set(['e1']))
  })

  it('finds the shortest path across multiple hops, ignoring edge direction', () => {
    // a -> b -> c -> d, plus a longer detour a -> x -> y -> z -> d
    const edges = [
      edge('e-ab', 'a', 'b'),
      edge('e-bc', 'b', 'c'),
      edge('e-cd', 'c', 'd'),
      edge('e-ax', 'a', 'x'),
      edge('e-xy', 'x', 'y'),
      edge('e-yz', 'y', 'z'),
      edge('e-zd', 'z', 'd'),
    ]
    const path = findPathBetweenNodes('a', 'd', edges)
    expect(path).toEqual(new Set(['e-ab', 'e-bc', 'e-cd']))
  })

  it('traverses edges regardless of source/target direction', () => {
    // path only exists if we walk edge e-ba "backwards" (target -> source)
    const edges = [edge('e-ba', 'b', 'a'), edge('e-bc', 'b', 'c')]
    expect(findPathBetweenNodes('a', 'c', edges)).toEqual(
      new Set(['e-ba', 'e-bc']),
    )
  })

  it('returns an empty set when no path exists', () => {
    const edges = [edge('e1', 'a', 'b'), edge('e2', 'x', 'y')]
    expect(findPathBetweenNodes('a', 'y', edges)).toEqual(new Set())
  })

  it('returns an empty set when a node is missing from the graph', () => {
    const edges = [edge('e1', 'a', 'b')]
    expect(findPathBetweenNodes('a', 'ghost', edges)).toEqual(new Set())
  })
})
