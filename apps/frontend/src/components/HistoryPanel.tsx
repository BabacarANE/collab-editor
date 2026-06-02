interface Snapshot {
  id: string
  name: string
  createdAt: string
  author: { email: string }
  content?: string
}

interface Props {
  snapshots: Snapshot[]
  snapshotName: string
  onSnapshotNameChange: (v: string) => void
  onCreateSnapshot: () => void
  onViewSnapshot: (id: string) => void
  onShowDiff: () => void
}

export default function HistoryPanel({
  snapshots, snapshotName, onSnapshotNameChange, onCreateSnapshot, onViewSnapshot, onShowDiff
}: Props) {
  return (
    <div className="w-72 border-l border-gray-200 flex flex-col gap-3 p-4 overflow-y-auto bg-gray-50">
      <div className="flex items-center justify-between">
        <span className="font-semibold text-sm text-gray-700">🕐 Versions</span>
        {snapshots.length >= 2 && (
          <button
            onClick={onShowDiff}
            className="text-xs px-2 py-1 rounded border border-gray-200 hover:bg-white text-gray-600 cursor-pointer"
          >
            🔍 Comparer
          </button>
        )}
      </div>

      <div className="flex flex-col gap-2">
        <input
          placeholder="Nom de la version..."
          value={snapshotName}
          onChange={e => onSnapshotNameChange(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && onCreateSnapshot()}
          className="px-2.5 py-1.5 text-sm border border-gray-200 rounded focus:outline-none focus:border-blue-400 bg-white"
        />
        <button
          onClick={onCreateSnapshot}
          className="py-1.5 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors cursor-pointer"
        >
          + Sauvegarder cette version
        </button>
      </div>

      <hr className="border-gray-200" />

      {snapshots.length === 0 ? (
        <p className="text-sm text-gray-400">Aucune version sauvegardée</p>
      ) : (
        <div className="flex flex-col gap-2">
          {snapshots.map(s => (
            <div
              key={s.id}
              onClick={() => onViewSnapshot(s.id)}
              className="p-3 border border-gray-200 rounded-lg cursor-pointer bg-white hover:border-blue-300 hover:shadow-sm transition-all"
            >
              <div className="text-sm font-medium text-gray-800">{s.name}</div>
              <div className="text-xs text-gray-400 mt-0.5">
                {new Date(s.createdAt).toLocaleDateString('fr-FR')} — {s.author.email}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}