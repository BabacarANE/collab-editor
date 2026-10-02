import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { FileText, Search } from 'lucide-react'
import { searchApi } from '../../api/endpoints'
import { relativeTime } from '../../lib/format'
import { sanitizeExcerpt } from '../../lib/sanitize'
import { useWorkspaceStore } from '../../store/workspaceStore'
import type { SearchResult } from '../../types'

interface Props {
  onClose: () => void
  onOpenDocument: (docId: string) => void
}

interface Item {
  id: string
  title: string
  updatedAt: string
  excerpt?: string
}

// Palette de recherche (⌘K) : documents récents puis recherche plein texte
export default function SearchDialog({ onClose, onOpenDocument }: Props) {
  const workspaceId = useWorkspaceStore(s => s.activeWorkspaceId)
  const recent = useWorkspaceStore(s => s.documents)
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<SearchResult[] | null>(null)
  const [loading, setLoading] = useState(false)
  const [selected, setSelected] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => { inputRef.current?.focus() }, [])

  const q = query.trim()
  const searching = q.length >= 2

  useEffect(() => {
    if (!searching) return
    const timer = setTimeout(async () => {
      setLoading(true)
      try {
        setResults(await searchApi.documents(q, workspaceId))
      } catch {
        setResults([])
      } finally {
        setLoading(false)
      }
    }, 250)
    return () => clearTimeout(timer)
  }, [q, searching, workspaceId])

  // Correspondances de titre instantanées, complétées par la recherche plein texte
  const titleMatches = searching ? recent.filter(d => d.title.toLowerCase().includes(q.toLowerCase())) : []
  const shownResults = searching
    ? [...titleMatches, ...(results ?? []).filter(r => !titleMatches.some(t => t.id === r.id))]
    : null
  const items: Item[] = shownResults ?? recent.slice(0, 8)
  const active = Math.min(selected, Math.max(items.length - 1, 0))

  const open = (id: string) => {
    onOpenDocument(id)
    onClose()
  }

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') onClose()
    else if (e.key === 'ArrowDown') { e.preventDefault(); setSelected(i => Math.min(i + 1, items.length - 1)) }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setSelected(i => Math.max(i - 1, 0)) }
    else if (e.key === 'Enter' && items[active]) open(items[active].id)
  }

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-start justify-center bg-black/40 px-4 pt-[12vh] animate-fade-in"
      onMouseDown={e => e.target === e.currentTarget && onClose()}
    >
      <div className="w-full max-w-xl overflow-hidden rounded-xl bg-white shadow-pop animate-pop-in" onKeyDown={onKeyDown}>
        <div className="flex items-center gap-3 border-b border-line px-4">
          <Search size={18} className="text-ink-muted" />
          <input
            ref={inputRef}
            value={query}
            onChange={e => { setQuery(e.target.value); setSelected(0) }}
            placeholder="Rechercher des documents…"
            className="h-14 flex-1 bg-transparent text-base text-ink outline-none placeholder:text-ink-muted"
          />
          {loading && searching && <span className="text-xs text-ink-muted">Recherche…</span>}
        </div>

        <div className="max-h-[50vh] overflow-y-auto p-2">
          <div className="px-2 pb-1 pt-1 text-xs font-medium text-ink-muted">
            {shownResults ? `${shownResults.length} résultat${shownResults.length > 1 ? 's' : ''}` : 'Documents récents'}
          </div>
          {items.length === 0 && (
            <div className="px-2 py-8 text-center text-sm text-ink-muted">
              {shownResults ? 'Aucun document ne correspond à cette recherche' : 'Aucun document pour le moment'}
            </div>
          )}
          {items.map((item, index) => (
            <button
              key={item.id}
              onMouseEnter={() => setSelected(index)}
              onClick={() => open(item.id)}
              className={`flex w-full items-start gap-3 rounded-lg px-2 py-2 text-left cursor-pointer ${index === active ? 'bg-hover' : ''}`}
            >
              <FileText size={16} className="mt-0.5 shrink-0 text-ink-muted" />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-medium text-ink">{item.title || 'Sans titre'}</span>
                {item.excerpt && (
                  <span
                    className="mt-0.5 line-clamp-2 block text-xs text-ink-soft [&_mark]:rounded-sm [&_mark]:bg-yellow-200 [&_mark]:px-0.5"
                    dangerouslySetInnerHTML={{ __html: sanitizeExcerpt(item.excerpt) }}
                  />
                )}
              </span>
              <span className="shrink-0 text-xs text-ink-muted">{relativeTime(item.updatedAt)}</span>
            </button>
          ))}
        </div>

        <div className="flex gap-4 border-t border-line bg-sidebar px-4 py-2 text-xs text-ink-muted">
          <span><kbd className="font-sans">↑↓</kbd> naviguer</span>
          <span><kbd className="font-sans">↵</kbd> ouvrir</span>
          <span><kbd className="font-sans">Échap</kbd> fermer</span>
        </div>
      </div>
    </div>,
    document.body
  )
}
