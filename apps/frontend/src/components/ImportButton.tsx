// ─── Nouveau composant : apps/frontend/src/components/ImportButton.tsx ──────

import { useRef, useState } from 'react'
import { api } from '../api/client'

interface Props {
  workspaceId: string
  onImported: (doc: { id: string; title: string; updatedAt: string }) => void
}

export default function ImportButton({ workspaceId, onImported }: Props) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleFile = async (file: File) => {
    setError('')
    setLoading(true)
    try {
      const formData = new FormData()
      formData.append('file', file)
      formData.append('workspaceId', workspaceId)

      const res = await api.post('/api/import', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      })
      onImported(res.data)
    } catch (e: any) {
      setError(e.response?.data?.error ?? 'Erreur import')
    } finally {
      setLoading(false)
      if (inputRef.current) inputRef.current.value = ''
    }
  }

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) handleFile(file)
  }

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    const file = e.dataTransfer.files?.[0]
    if (file) handleFile(file)
  }

  return (
    <div>
      <div
        onDrop={handleDrop}
        onDragOver={e => e.preventDefault()}
        onClick={() => inputRef.current?.click()}
        style={{
          border: '2px dashed #ddd',
          borderRadius: 8,
          padding: '10px 16px',
          cursor: 'pointer',
          textAlign: 'center',
          fontSize: 13,
          color: '#999',
          background: '#fafafa',
          transition: 'border-color 0.2s',
          userSelect: 'none'
        }}
        onMouseEnter={e => (e.currentTarget.style.borderColor = '#1a73e8')}
        onMouseLeave={e => (e.currentTarget.style.borderColor = '#ddd')}
      >
        {loading
          ? '⏳ Import en cours...'
          : '📂 Importer .md / .docx / .txt — cliquer ou glisser'}
      </div>

      <input
        ref={inputRef}
        type="file"
        accept=".md,.markdown,.docx,.txt"
        style={{ display: 'none' }}
        onChange={handleChange}
      />

      {error && (
        <p style={{ color: '#ef4444', fontSize: 12, margin: '6px 0 0' }}>{error}</p>
      )}
    </div>
  )
}
