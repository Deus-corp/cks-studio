// Copyright (c) 2026 Deus Corp. Licensed under MIT.

import { useNavigate } from 'react-router-dom'
import { DEMO_GRAPH_OBJECT_COUNT } from '@/services/mockClient'
import { useDemoToast } from './DemoToast'

interface DemoGalleryCard {
  name: string
  sessionId: string
  description: string
  tags: string[]
  objectCount: number
  updatedLabel: string
  public: boolean
  /** Only the bundled cks-ecosystem graph actually exists in the demo --
   *  the rest are illustrative entries so the gallery doesn't read as a
   *  single-item list, but there's no data behind them to open. */
  functional: boolean
}

const CARDS: DemoGalleryCard[] = [
  {
    name: 'cks-ecosystem',
    sessionId: 'demo-ecosystem',
    description:
      'The CKS project ecosystem itself: components, modules, ADRs and their relations, self-hosted as a knowledge graph. This is the graph the Graph tab of this demo already shows.',
    tags: ['self-hosted', 'architecture', 'public'],
    objectCount: DEMO_GRAPH_OBJECT_COUNT,
    updatedLabel: 'a few minutes ago',
    public: true,
    functional: true,
  },
  {
    name: 'water-cycle',
    sessionId: 'example-water-cycle',
    description:
      "A textbook example graph: evaporation, condensation, precipitation and collection as Process nodes, connected by 'causes' and 'part_of' relations. Useful for demoing cyclical structures.",
    tags: ['example', 'science', 'public'],
    objectCount: 24,
    updatedLabel: '3 days ago',
    public: true,
    functional: false,
  },
  {
    name: 'neural-networks-101',
    sessionId: 'example-nn-101',
    description:
      'Concepts from a short course: layers, activation functions, backpropagation, and how they relate. Built to show off contradiction and staleness detection on a fast-moving topic.',
    tags: ['example', 'ml', 'public'],
    objectCount: 41,
    updatedLabel: '1 week ago',
    public: true,
    functional: false,
  },
  {
    name: 'product-roadmap-q3',
    sessionId: 'example-roadmap-q3',
    description:
      'A private planning graph: initiatives, owners, and dependencies for a quarter. Shown here to illustrate a non-public entry -- these are hidden from list_graphs by default.',
    tags: ['private', 'planning'],
    objectCount: 17,
    updatedLabel: '2 weeks ago',
    public: false,
    functional: false,
  },
]

function GalleryCard({ card }: { card: DemoGalleryCard }) {
  const navigate = useNavigate()
  const { showToast } = useDemoToast()

  const handleOpen = () => {
    if (card.functional) {
      navigate('/')
      return
    }
    showToast('Demo only — no data behind this card')
  }

  return (
    <div className="bg-surface-1 border border-border-subtle rounded p-3 flex flex-col gap-2">
      <div className="flex items-start justify-between gap-2">
        <div>
          <h3 className="text-sm font-semibold text-text-primary">
            {card.name}
          </h3>
          <p className="text-xs text-text-tertiary">{card.sessionId}</p>
        </div>
        {card.public && (
          <span className="text-[10px] uppercase tracking-wide text-accent bg-accent-muted px-1.5 py-0.5 rounded flex-shrink-0">
            Public
          </span>
        )}
      </div>

      <p className="text-xs text-text-secondary line-clamp-3">
        {card.description}
      </p>

      <div className="flex flex-wrap gap-1">
        {card.tags.map((tag) => (
          <span
            key={tag}
            className="text-[10px] text-text-secondary bg-surface-2 px-1.5 py-0.5 rounded"
          >
            {tag}
          </span>
        ))}
      </div>

      <p className="text-[10px] text-text-tertiary">
        {card.objectCount} objects · updated {card.updatedLabel}
      </p>

      <div className="flex items-center justify-between mt-1">
        <span
          className={`w-2 h-2 rounded-full inline-block flex-shrink-0 ${
            card.functional ? 'bg-green-500' : 'bg-text-tertiary'
          }`}
          title={card.functional ? 'available in this demo' : 'demo only'}
        />
        <button
          type="button"
          onClick={handleOpen}
          className="text-xs bg-accent hover:bg-accent-strong text-white px-2 py-1 rounded"
        >
          Open in Graph
        </button>
      </div>
    </div>
  )
}

/**
 * Static stand-in for GraphGallery (which normally lists graphs via
 * search_graphs/list_graphs against a live cks-mcp server). Only
 * cks-ecosystem, the graph bundled into this demo, is actually openable;
 * the rest are illustrative examples so the layout reads as a real
 * gallery rather than a single-card page.
 */
export function DemoGalleryPage() {
  return (
    <div className="h-full flex flex-col">
      <div className="flex items-center gap-2 px-4 py-3 border-b border-border-subtle">
        <h2 className="text-sm font-semibold text-text-primary">
          Graph Gallery
        </h2>
        <span className="text-xs text-text-tertiary">
          Static demo — only cks-ecosystem is openable
        </span>
      </div>

      <div className="flex-1 overflow-y-auto p-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 content-start">
        {CARDS.map((card) => (
          <GalleryCard key={card.sessionId} card={card} />
        ))}
      </div>
    </div>
  )
}
