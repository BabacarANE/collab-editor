import { useState } from 'react'
import { GitCompare, History, X } from 'lucide-react'
import { relativeTime } from '../../lib/format'
import type { Snapshot } from '../../types'
import { Button } from '../ui/Button'

interface Props {
  snapshots: Snapshot[]
  canSave: boolean
  onSave: (name: string) => Promise<void>
  onView: (snapshot: Snapshot) => void
  onCompare: () => void
  onClose: () => void
}

// Historique des versions nommées, présenté comme une frise
export default function HistoryPanel({ snapshots, canSave, onSave, onView, onCompare, onClose }: Props) {
  const [name, setName] = useState('')
  const [busy, setBusy] = useState(false)

  const save = async (e: React.FormEvent) => {
    e.preventDefault()
    setBusy(true)
    try {
      await onSave(name.trim())
      setName('')
    } finally {
      setBusy(false)
    }
  }

  return (
    <aside className="flex w-80 shrink-0 flex-col border-l border-line bg-surface animate-slide-in">
      <div className="flex h-12 items-center justify-between border-b border-line px-4">
        <span className="text-sm font-semibold text-ink">Historique des versions</span>
        <button onClick={onClose} aria-label="Fermer" className="rounded-md p-1 text-ink-muted hover:bg-hover hover:text-ink cursor-pointer">
          <X size={16} />
        </button>
      </div>

      {canSave && (
        <form onSubmit={save} className="space-y-2 border-b border-line p-4">
          <input
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder="Nommer cette version (facultatif)"
            className="h-9 w-full rounded-md border border-control px-3 text-sm outline-none focus:border-accent focus:ring-2 focus:ring-accent/30"
          />
          <Button type="submit" variant="primary" size="sm" className="w-full" disabled={busy}>
            Enregistrer la version actuelle
          </Button>
        </form>
      )}

      <div className="flex-1 overflow-y-auto p-2">
        {snapshots.length >= 2 && (
          <button onClick={onCompare} className="mb-1 flex w-full items-center gap-2 rounded-md px-2 py-2 text-sm text-accent hover:bg-accent-soft cursor-pointer">
            <GitCompare size={15} /> Comparer deux versions
          </button>
        )}
        {snapshots.length === 0 ? (
          <div className="flex flex-col items-center px-4 py-10 text-center text-ink-muted">
            <History size={28} className="mb-2" />
            <p className="text-sm">Aucune version enregistrée</p>
          </div>
        ) : (
          <ol className="relative ml-4 border-l border-line-strong">
            {snapshots.map((s, i) => (
              <li key={s.id} className="relative">
                <span className={`absolute -left-[5px] top-4 h-2.5 w-2.5 rounded-full ${i === 0 ? 'bg-accent' : 'bg-line-strong'}`} />
                <button onClick={() => onView(s)} className="ml-3 w-[calc(100%-0.75rem)] rounded-md px-3 py-2.5 text-left hover:bg-hover cursor-pointer">
                  <div className="truncate text-sm font-medium text-ink">{s.name}</div>
                  <div className="text-xs text-ink-muted">{relativeTime(s.createdAt)} · {s.author.email.split('@')[0]}</div>
                </button>
              </li>
            ))}
          </ol>
        )}
      </div>
    </aside>
  )
}
