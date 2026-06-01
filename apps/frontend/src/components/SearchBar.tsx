import { useState, useCallback, useRef } from 'react'
import { api } from '../api/client'

interface SearchResult {
  id: string
  title: string
  workspaceId: string
  updatedAt: string
  rank: number
  excerpt: string
}

interface Props {
  workspaceId?: string
  onOpenDocument: (docId: string) => void
}

export default function SearchBar({ workspaceId, onOpenDocument }: Props) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<SearchResult[]>([])
  const [loading, setLoading] = useState(false)
  const [open, setOpen] = useState(false)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const search = useCallback(async (q: string) => {
    if (q.trim().length < 2) {
      setResults([])
      setOpen(false)
      return
    }
    setLoading(true)
    try {
      const params = new URLSearchParams({ q })
      if (workspaceId) params.set('workspaceId', workspaceId)
      const res = await api.get(`/api/search?${params}`)
      setResults(res.data)
      setOpen(true)
    } catch {
      setResults([])
    } finally {
      setLoading(false)
    }
  }, [workspaceId])

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value
    setQuery(val)
    if (timerRef.current) clearTimeout(timerRef.current)
    timerRef.current = setTimeout(() => search(val), 300)
  }

  const handleSelect = (docId: string) => {
    setOpen(false)
    setQuery('')
    setResults([])
    onOpenDocument(docId)
  }

  return (
    <div style={{ position: 'relative', width: '100%', maxWidth: 420 }}>
      <input
        placeholder="🔍 Rechercher dans les documents..."
        value={query}
        onChange={handleChange}
        onFocus={() => results.length > 0 && setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 200)}
        style={{
          width: '100%',
          padding: '8px 12px',
          fontSize: 14,
          borderRadius: 6,
          border: '1px solid #ddd',
          outline: 'none',
          boxSizing: 'border-box'
        }}
      />

      {loading && (
        <div style={{ position: 'absolute', right: 10, top: 10, fontSize: 12, color: '#999' }}>
          ⏳
        </div>
      )}

      {open && results.length > 0 && (
        <div style={{
          position: 'absolute',
          top: '110%',
          left: 0,
          right: 0,
          background: 'white',
          border: '1px solid #eee',
          borderRadius: 8,
          boxShadow: '0 4px 16px rgba(0,0,0,0.1)',
          zIndex: 50,
          maxHeight: 360,
          overflowY: 'auto'
        }}>
          {results.map(r => (
            <div
              key={r.id}
              onMouseDown={() => handleSelect(r.id)}
              style={{
                padding: '10px 14px',
                cursor: 'pointer',
                borderBottom: '1px solid #f5f5f5'
              }}
              onMouseEnter={e => (e.currentTarget.style.background = '#f8f9fa')}
              onMouseLeave={e => (e.currentTarget.style.background = 'white')}
            >
              <div style={{ fontWeight: 500, fontSize: 14, marginBottom: 4 }}>
                📄 {r.title}
              </div>
              {r.excerpt && (
                <div
                  style={{ fontSize: 12, color: '#666', lineHeight: 1.5 }}
                  dangerouslySetInnerHTML={{ __html: r.excerpt }}
                />
              )}
              <div style={{ fontSize: 11, color: '#bbb', marginTop: 4 }}>
                {new Date(r.updatedAt).toLocaleDateString('fr-FR')}
              </div>
            </div>
          ))}
        </div>
      )}

      {open && results.length === 0 && query.trim().length >= 2 && !loading && (
        <div style={{
          position: 'absolute',
          top: '110%',
          left: 0,
          right: 0,
          background: 'white',
          border: '1px solid #eee',
          borderRadius: 8,
          padding: '12px 14px',
          fontSize: 13,
          color: '#999',
          zIndex: 50
        }}>
          Aucun résultat pour « {query} »
        </div>
      )}

      <style>{`
        mark { background: #fef08a; padding: 0 2px; border-radius: 2px; }
      `}</style>
    </div>
  )
}
