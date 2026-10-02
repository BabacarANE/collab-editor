import { useEffect, useState } from 'react'
import DiffMatchPatch from 'diff-match-patch'
import { ArrowRight } from 'lucide-react'
import { api } from '../../api/client'
import { relativeTime } from '../../lib/format'
import type { Snapshot } from '../../types'
import { Modal } from '../ui/Modal'

interface Props {
  docId: string
  snapshots: Snapshot[]
  onClose: () => void
}

type Diff = [number, string][]

// Texte brut d'un contenu HTML (le parseur du navigateur n'exécute rien)
function htmlToText(html: string): string {
  const doc = new DOMParser().parseFromString(html.replace(/<\/(p|h[1-6]|li|blockquote|pre)>/gi, '$&\n'), 'text/html')
  return (doc.body.textContent ?? '').replace(/\n{3,}/g, '\n\n').trim()
}

function computeDiff(oldText: string, newText: string): Diff {
  const dmp = new DiffMatchPatch()
  const diffs = dmp.diff_main(oldText, newText)
  dmp.diff_cleanupSemantic(diffs)
  return diffs
}

export default function SnapshotDiffDialog({ docId, snapshots, onClose }: Props) {
  const [leftId, setLeftId] = useState(snapshots[1]?.id ?? '')
  const [rightId, setRightId] = useState(snapshots[0]?.id ?? '')
  const [diff, setDiff] = useState<Diff | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!leftId || !rightId || leftId === rightId) {
      setDiff(null)
      return
    }
    let cancelled = false
    setError('')
    // Contenus chargés à la demande, uniquement pour les deux versions choisies
    Promise.all([leftId, rightId].map(id => api.get<Snapshot>(`/api/documents/${docId}/snapshots/${id}`)))
      .then(([left, right]) => {
        if (!cancelled) setDiff(computeDiff(htmlToText(left.data.content ?? ''), htmlToText(right.data.content ?? '')))
      })
      .catch(() => !cancelled && setError('Impossible de charger les versions'))
    return () => { cancelled = true }
  }, [docId, leftId, rightId])

  const select = (value: string, onChange: (v: string) => void, label: string) => (
    <label className="flex-1">
      <span className="mb-1 block text-xs text-ink-muted">{label}</span>
      <select value={value} onChange={e => onChange(e.target.value)} className="h-9 w-full rounded-md border border-line-strong bg-white px-2 text-sm">
        {snapshots.map(s => <option key={s.id} value={s.id}>{s.name} — {relativeTime(s.createdAt)}</option>)}
      </select>
    </label>
  )

  return (
    <Modal title="Comparer deux versions" onClose={onClose} width="max-w-3xl">
      <div className="flex items-end gap-3">
        {select(leftId, setLeftId, 'Version de référence')}
        <ArrowRight size={18} className="mb-2.5 text-ink-muted" />
        {select(rightId, setRightId, 'Version comparée')}
      </div>

      <div className="mt-3 flex gap-3 text-xs">
        <span className="rounded bg-emerald-100 px-2 py-0.5 text-emerald-800">Ajouté</span>
        <span className="rounded bg-red-100 px-2 py-0.5 text-red-800 line-through">Supprimé</span>
      </div>

      {error && <p className="mt-3 rounded-md bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>}

      <div className="mt-3 max-h-[50vh] min-h-40 overflow-y-auto whitespace-pre-wrap rounded-lg border border-line p-4 text-sm leading-7 text-ink">
        {leftId === rightId ? (
          <span className="text-ink-muted">Choisissez deux versions différentes.</span>
        ) : !diff ? (
          <span className="text-ink-muted">Chargement…</span>
        ) : diff.map(([op, text], i) =>
          op === 1 ? <ins key={i} className="rounded-sm bg-emerald-100 text-emerald-900 no-underline">{text}</ins>
          : op === -1 ? <del key={i} className="rounded-sm bg-red-100 text-red-900">{text}</del>
          : <span key={i}>{text}</span>
        )}
      </div>
    </Modal>
  )
}
