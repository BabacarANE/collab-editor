// apps/frontend/src/components/SnapshotDiff.tsx
import { useState } from 'react'
import DiffMatchPatch from 'diff-match-patch'

interface Snapshot {
  id: string
  name: string
  createdAt: string
  author: { email: string }
  content?: string
}

interface Props {
  snapshots: Snapshot[]
  onClose: () => void
}

function htmlToText(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n')
    .replace(/<\/h[1-6]>/gi, '\n')
    .replace(/<\/li>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

function buildDiffHtml(oldText: string, newText: string): string {
  const dmp = new DiffMatchPatch()
  const diffs = dmp.diff_main(oldText, newText)
  dmp.diff_cleanupSemantic(diffs)

  return diffs.map(([op, text]) => {
    const escaped = text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/\n/g, '<br>')

    if (op === 1) {
      return `<ins style="background:#dcfce7;color:#166534;text-decoration:none;padding:1px 2px;border-radius:2px;">${escaped}</ins>`
    } else if (op === -1) {
      return `<del style="background:#fee2e2;color:#991b1b;text-decoration:line-through;padding:1px 2px;border-radius:2px;">${escaped}</del>`
    } else {
      return `<span>${escaped}</span>`
    }
  }).join('')
}

export default function SnapshotDiff({ snapshots, onClose }: Props) {
  const [leftId, setLeftId] = useState(snapshots[1]?.id ?? snapshots[0]?.id ?? '')
  const [rightId, setRightId] = useState(snapshots[0]?.id ?? '')
  const [diffHtml, setDiffHtml] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const compute = async () => {
    setError('')
    setDiffHtml(null)

    const left = snapshots.find(s => s.id === leftId)
    const right = snapshots.find(s => s.id === rightId)

    if (!left || !right) {
      setError('Sélectionne deux versions')
      return
    }
    if (leftId === rightId) {
      setError('Sélectionne deux versions différentes')
      return
    }

    setLoading(true)
    try {
      // Les contenus sont déjà chargés si on les passe, sinon message d'erreur
      if (!left.content || !right.content) {
        setError('Contenu non disponible — clique d\'abord sur chaque version pour la charger')
        return
      }

      const oldText = htmlToText(left.content)
      const newText = htmlToText(right.content)
      setDiffHtml(buildDiffHtml(oldText, newText))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 200
    }}>
      <div style={{
        background: 'white', borderRadius: 12, padding: 24,
        width: '80vw', maxWidth: 860, maxHeight: '85vh',
        display: 'flex', flexDirection: 'column', gap: 16, overflow: 'hidden'
      }}>
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h3 style={{ margin: 0, fontSize: 16 }}>🔍 Comparaison de versions</h3>
          <button onClick={onClose}
            style={{ background: 'none', border: 'none', fontSize: 18, cursor: 'pointer', color: '#666' }}>✕</button>
        </div>

        {/* Sélecteurs */}
        <div style={{ display: 'flex', gap: 12, alignItems: 'flex-end' }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 12, color: '#666', marginBottom: 4 }}>Version de base (ancienne)</div>
            <select value={leftId} onChange={e => setLeftId(e.target.value)}
              style={{ width: '100%', padding: '8px 10px', borderRadius: 6, border: '1px solid #ddd', fontSize: 13 }}>
              {snapshots.map(s => (
                <option key={s.id} value={s.id}>
                  {s.name} — {new Date(s.createdAt).toLocaleDateString('fr-FR')}
                </option>
              ))}
            </select>
          </div>

          <div style={{ fontSize: 18, color: '#999', paddingBottom: 8 }}>→</div>

          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 12, color: '#666', marginBottom: 4 }}>Version comparée (nouvelle)</div>
            <select value={rightId} onChange={e => setRightId(e.target.value)}
              style={{ width: '100%', padding: '8px 10px', borderRadius: 6, border: '1px solid #ddd', fontSize: 13 }}>
              {snapshots.map(s => (
                <option key={s.id} value={s.id}>
                  {s.name} — {new Date(s.createdAt).toLocaleDateString('fr-FR')}
                </option>
              ))}
            </select>
          </div>

          <button onClick={compute} disabled={loading}
            style={{
              padding: '8px 20px', background: '#1a73e8', color: 'white',
              border: 'none', borderRadius: 6, cursor: 'pointer', fontSize: 13,
              opacity: loading ? 0.7 : 1, whiteSpace: 'nowrap'
            }}>
            {loading ? '⏳' : 'Comparer'}
          </button>
        </div>

        {/* Légende */}
        <div style={{ display: 'flex', gap: 16, fontSize: 12 }}>
          <span style={{ background: '#dcfce7', color: '#166534', padding: '2px 8px', borderRadius: 4 }}>+ Ajouté</span>
          <span style={{ background: '#fee2e2', color: '#991b1b', padding: '2px 8px', borderRadius: 4, textDecoration: 'line-through' }}>Supprimé</span>
        </div>

        {error && <p style={{ color: '#ef4444', fontSize: 13, margin: 0 }}>{error}</p>}

        {/* Résultat diff */}
        {diffHtml && (
          <div style={{
            flex: 1, overflowY: 'auto', padding: 16,
            border: '1px solid #eee', borderRadius: 8,
            fontSize: 14, lineHeight: 1.8, fontFamily: 'sans-serif'
          }}
            dangerouslySetInnerHTML={{ __html: diffHtml }}
          />
        )}

        {!diffHtml && !error && (
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#bbb', fontSize: 14 }}>
            Sélectionne deux versions et clique sur Comparer
          </div>
        )}
      </div>
    </div>
  )
}
