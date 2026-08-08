// Copyright (c) 2025 Deus Corp. Licensed under MIT.

/** Идентификатор объекта в CKS */
export interface CksIdentity {
  id: string
  type: string
  name: string
}

/** Единичный объект знания */
export interface CksObject {
  identity: CksIdentity
  structure: Record<string, unknown>
}

/** Связь между объектами */
export interface CksRelation {
  identity: CksIdentity
  participants: string[]
  relation_type: string
}

/** Ответ инструмента query_subgraph (упрощённый) */
export interface SubgraphResult {
  nodes: CksObject[]
  edges: {
    source: string
    target: string
    relation_type: string
  }[]
}

export interface ForkVersionData {
  object_id: string
  origin_node: string
  created_at: string
  structure: Record<string, unknown>
}
