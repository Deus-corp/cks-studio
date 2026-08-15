// Copyright (c) 2026 Deus Corp. Licensed under MIT.

import { useState } from 'react'
import { registerGraph } from '@/services/mcpTools'

type Visibility = 'private' | 'team' | 'public'

/**
 * "Publish to Gallery" button for the graph page's side panel. Wraps
 * register_graph (the same tool an LLM/MCP client already calls
 * directly) behind a small form, so publishing a graph -- including
 * scoping it to a team, not just public/private -- doesn't require
 * going outside the Studio UI.
 *
 * Deliberately its own component rather than inlined into GraphPage:
 * GraphPage is already large, and this owns a self-contained bit of
 * form state (name/description/tags/visibility) that has nothing to
 * do with the graph canvas itself.
 */
export function PublishToGalleryButton({ sessionId }: { sessionId: string }) {
  const [isOpen, setIsOpen] = useState(false)
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [tags, setTags] = useState('')
  const [visibility, setVisibility] = useState<Visibility>('private')
  const [team, setTeam] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [publishedName, setPublishedName] = useState<string | null>(null)

  const resetAndClose = () => {
    setIsOpen(false)
    setError(null)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim()) {
      setError('Name is required.')
      return
    }
    if (visibility === 'team' && !team.trim()) {
      setError('Team name is required for team visibility.')
      return
    }
    setIsSubmitting(true)
    setError(null)
    try {
      const result = await registerGraph({
        name: name.trim(),
        sessionId,
        description: description.trim(),
        tags: tags.trim(),
        isPublic: visibility === 'public',
        visibility,
        team: visibility === 'team' ? team.trim() : undefined,
      })
      setPublishedName(result.name)
      setIsOpen(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => {
          setPublishedName(null)
          setIsOpen(true)
        }}
        disabled={!sessionId.trim()}
        title="Register this session as a named graph in the Gallery"
        className="w-full rounded bg-surface-3 px-4 py-2 text-sm font-medium text-text-primary hover:bg-border disabled:opacity-50 disabled:cursor-not-allowed"
      >
        📚 Publish to Gallery
      </button>

      {publishedName && !isOpen && (
        <p className="text-[11px] text-success">
          Published as “{publishedName}”.
        </p>
      )}

      {isOpen && (
        <div
          className="fixed inset-0 z-30 flex items-center justify-center bg-surface-0/60 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          aria-label="Publish to Gallery"
        >
          <button
            type="button"
            className="absolute inset-0"
            onClick={resetAndClose}
            aria-label="Close publish dialog"
          />
          <form
            onSubmit={handleSubmit}
            className="relative z-10 w-96 bg-surface-1 border border-border-subtle rounded-lg p-4 flex flex-col gap-3 shadow-xl"
          >
            <h2 className="text-sm font-semibold text-text-primary">
              Publish to Gallery
            </h2>
            <p className="text-xs text-text-tertiary">
              Registers session <code>{sessionId}</code> under a memorable name
              via register_graph, so it shows up in the Gallery.
            </p>

            <label className="flex flex-col gap-1 text-xs text-text-secondary">
              Name
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. onboarding-flow-v2"
                className="bg-surface-2 border border-border rounded px-2 py-1 text-text-primary placeholder:text-text-tertiary"
              />
            </label>

            <label className="flex flex-col gap-1 text-xs text-text-secondary">
              Description
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={2}
                placeholder="What does this graph contain?"
                className="bg-surface-2 border border-border rounded px-2 py-1 text-text-primary placeholder:text-text-tertiary resize-none"
              />
            </label>

            <label className="flex flex-col gap-1 text-xs text-text-secondary">
              Tags (comma-separated)
              <input
                type="text"
                value={tags}
                onChange={(e) => setTags(e.target.value)}
                placeholder="demo, onboarding"
                className="bg-surface-2 border border-border rounded px-2 py-1 text-text-primary placeholder:text-text-tertiary"
              />
            </label>

            <fieldset className="flex flex-col gap-1.5">
              <legend className="text-xs text-text-secondary mb-1">
                Who can find this graph?
              </legend>
              {(
                [
                  ['private', 'Private — only me, by exact name'],
                  ['team', 'Team — anyone in the same team namespace'],
                  ['public', 'Public — everyone in the Gallery'],
                ] as [Visibility, string][]
              ).map(([value, label]) => (
                <label
                  key={value}
                  className="flex items-center gap-2 text-xs text-text-primary"
                >
                  <input
                    type="radio"
                    name="visibility"
                    value={value}
                    checked={visibility === value}
                    onChange={() => setVisibility(value)}
                  />
                  {label}
                </label>
              ))}
            </fieldset>

            {visibility === 'team' && (
              <label className="flex flex-col gap-1 text-xs text-text-secondary">
                Team name
                <input
                  type="text"
                  value={team}
                  onChange={(e) => setTeam(e.target.value)}
                  placeholder="e.g. acme-eng"
                  className="bg-surface-2 border border-border rounded px-2 py-1 text-text-primary placeholder:text-text-tertiary"
                />
                <span className="text-[10px] text-text-tertiary">
                  Not real access control — anyone who knows this team name can
                  list/search it too. Treat it as a shared namespace.
                </span>
              </label>
            )}

            {error && <p className="text-xs text-danger">{error}</p>}

            <div className="flex items-center justify-end gap-2 mt-1">
              <button
                type="button"
                onClick={resetAndClose}
                className="text-xs bg-surface-2 hover:bg-surface-3 text-text-primary px-3 py-1.5 rounded"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="text-xs bg-accent hover:bg-accent-strong text-white px-3 py-1.5 rounded disabled:opacity-50"
              >
                {isSubmitting ? 'Publishing…' : 'Publish'}
              </button>
            </div>
          </form>
        </div>
      )}
    </>
  )
}
