import type { ForkVersionData } from '@/shared/types/graph'

interface ForkDiffPanelProps {
  versions: ForkVersionData[]
}

function DiffField({
  label,
  valueA,
  valueB,
}: {
  label: string
  valueA: string | undefined
  valueB: string | undefined
}) {
  const isDiff = valueA !== valueB
  return (
    <div className="text-sm">
      <div className="text-gray-500 text-xs">{label}</div>
      <div className="flex gap-2 mt-1">
        <div className={`flex-1 p-1 rounded ${isDiff ? 'bg-red-900/30 border border-red-700' : 'bg-gray-800'}`}>
          <span className={isDiff ? 'text-red-300' : 'text-gray-300'}>{valueA || '—'}</span>
        </div>
        <div className={`flex-1 p-1 rounded ${isDiff ? 'bg-green-900/30 border border-green-700' : 'bg-gray-800'}`}>
          <span className={isDiff ? 'text-green-300' : 'text-gray-300'}>{valueB || '—'}</span>
        </div>
      </div>
    </div>
  )
}

export function ForkDiffPanel({ versions }: ForkDiffPanelProps) {
  if (versions.length !== 2) {
    return <div className="text-red-400 p-2">Fork requires exactly 2 versions.</div>
  }

  const [v1, v2] = versions
  const allKeys = new Set([...Object.keys(v1.structure), ...Object.keys(v2.structure)])

  return (
    <div className="space-y-3 p-2">
      <div className="flex text-xs text-gray-500">
        <div className="flex-1 text-center">{v1.origin_node} ({new Date(v1.created_at).toLocaleDateString()})</div>
        <div className="flex-1 text-center">{v2.origin_node} ({new Date(v2.created_at).toLocaleDateString()})</div>
      </div>
      {[...allKeys].map((key) => (
        <DiffField
          key={key}
          label={key}
          valueA={v1.structure[key] as string | undefined}
          valueB={v2.structure[key] as string | undefined}
        />
      ))}
    </div>
  )
}