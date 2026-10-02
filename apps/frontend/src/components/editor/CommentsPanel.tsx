import { useState } from 'react'
import { Check, MessageSquare, Trash2, X } from 'lucide-react'
import { relativeTime } from '../../lib/format'
import type { Comment } from '../../types'
import { Avatar } from '../ui/Avatar'
import { Button } from '../ui/Button'

interface Props {
  comments: Comment[]
  currentUserId?: string
  canComment: boolean
  // Éditeurs/propriétaire : résoudre tout ; propriétaire : supprimer tout
  canResolveAll: boolean
  canDeleteAll: boolean
  onPost: (content: string, parentId?: string) => Promise<void>
  onResolve: (id: string) => Promise<void>
  onDelete: (id: string) => Promise<void>
  onClose: () => void
}

function Composer({ placeholder, onSubmit, onCancel, autoFocus }: {
  placeholder: string; onSubmit: (text: string) => Promise<void>; onCancel?: () => void; autoFocus?: boolean
}) {
  const [text, setText] = useState('')
  const [busy, setBusy] = useState(false)

  const submit = async () => {
    if (!text.trim() || busy) return
    setBusy(true)
    try {
      await onSubmit(text.trim())
      setText('')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="rounded-lg border border-line-strong bg-white focus-within:border-accent focus-within:ring-2 focus-within:ring-accent-soft">
      <textarea
        autoFocus={autoFocus}
        value={text}
        onChange={e => setText(e.target.value)}
        onKeyDown={e => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) submit() }}
        placeholder={placeholder}
        rows={2}
        className="block w-full resize-none rounded-lg bg-transparent px-3 py-2 text-sm outline-none"
      />
      {(text || onCancel) && (
        <div className="flex justify-end gap-1.5 px-2 pb-2">
          {onCancel && <Button size="sm" variant="ghost" onClick={onCancel}>Annuler</Button>}
          <Button size="sm" variant="primary" disabled={!text.trim() || busy} onClick={submit}>Commenter</Button>
        </div>
      )}
    </div>
  )
}

// Fil de commentaires façon Google Docs : cartes, réponses, résolution
export default function CommentsPanel({
  comments, currentUserId, canComment, canResolveAll, canDeleteAll, onPost, onResolve, onDelete, onClose
}: Props) {
  const [replyTo, setReplyTo] = useState<string | null>(null)
  const [showResolved, setShowResolved] = useState(false)

  const open = comments.filter(c => !c.resolved)
  const resolved = comments.filter(c => c.resolved)
  const visible = showResolved ? comments : open

  return (
    <aside className="flex w-80 shrink-0 flex-col border-l border-line bg-white animate-slide-in">
      <div className="flex h-12 items-center justify-between border-b border-line px-4">
        <span className="text-sm font-semibold text-ink">Commentaires</span>
        <button onClick={onClose} aria-label="Fermer" className="rounded-md p-1 text-ink-muted hover:bg-hover hover:text-ink cursor-pointer">
          <X size={16} />
        </button>
      </div>

      <div className="flex-1 space-y-3 overflow-y-auto bg-sidebar p-3">
        {canComment && <Composer placeholder="Ajouter un commentaire…" onSubmit={text => onPost(text)} />}

        {visible.length === 0 && (
          <div className="flex flex-col items-center px-4 py-10 text-center text-ink-muted">
            <MessageSquare size={28} className="mb-2" />
            <p className="text-sm">{open.length === 0 && resolved.length > 0 ? 'Tous les commentaires sont résolus' : 'Aucun commentaire'}</p>
          </div>
        )}

        {visible.map(c => {
          const canDelete = c.author.id === currentUserId || canDeleteAll
          return (
            <article key={c.id} className={`rounded-lg border bg-white p-3 shadow-sm ${c.resolved ? 'border-line opacity-60' : 'border-line'}`}>
              <header className="mb-2 flex items-start gap-2">
                <Avatar email={c.author.email} id={c.author.id} size={28} />
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-medium text-ink">{c.author.email.split('@')[0]}</div>
                  <div className="text-xs text-ink-muted">{relativeTime(c.createdAt)}</div>
                </div>
                {!c.resolved && (canResolveAll || c.author.id === currentUserId) && (
                  <button onClick={() => onResolve(c.id)} title="Résoudre" className="rounded-md p-1 text-ink-muted hover:bg-accent-soft hover:text-accent cursor-pointer">
                    <Check size={16} />
                  </button>
                )}
                {canDelete && (
                  <button onClick={() => onDelete(c.id)} title="Supprimer" className="rounded-md p-1 text-ink-muted hover:bg-red-50 hover:text-red-600 cursor-pointer">
                    <Trash2 size={15} />
                  </button>
                )}
              </header>
              <p className="whitespace-pre-wrap break-words text-sm text-ink">{c.content}</p>

              {c.replies.length > 0 && (
                <div className="mt-3 space-y-2.5 border-t border-line pt-2.5">
                  {c.replies.map(r => (
                    <div key={r.id} className="flex gap-2">
                      <Avatar email={r.author.email} id={r.author.id} size={22} />
                      <div className="min-w-0">
                        <div className="text-xs">
                          <span className="font-medium text-ink">{r.author.email.split('@')[0]}</span>{' '}
                          <span className="text-ink-muted">{relativeTime(r.createdAt)}</span>
                        </div>
                        <p className="whitespace-pre-wrap break-words text-sm text-ink">{r.content}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {c.resolved ? (
                <div className="mt-2 flex items-center gap-1 text-xs text-emerald-600"><Check size={12} /> Résolu</div>
              ) : canComment && (
                replyTo === c.id ? (
                  <div className="mt-3">
                    <Composer
                      autoFocus
                      placeholder="Répondre…"
                      onSubmit={async text => { await onPost(text, c.id); setReplyTo(null) }}
                      onCancel={() => setReplyTo(null)}
                    />
                  </div>
                ) : (
                  <button onClick={() => setReplyTo(c.id)} className="mt-2 text-xs font-medium text-accent hover:underline cursor-pointer">
                    Répondre
                  </button>
                )
              )}
            </article>
          )
        })}

        {resolved.length > 0 && (
          <button onClick={() => setShowResolved(s => !s)} className="w-full py-1 text-xs text-ink-soft hover:text-ink cursor-pointer">
            {showResolved ? 'Masquer' : 'Afficher'} les commentaires résolus ({resolved.length})
          </button>
        )}
      </div>
    </aside>
  )
}
