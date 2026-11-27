import { useRef, useState } from 'react'
import { Upload } from 'lucide-react'
import { documentsApi } from '../../api/endpoints'
import { apiError } from '../../lib/format'
import type { DocumentSummary } from '../../types'
import { Modal } from '../ui/Modal'

interface Props {
  workspaceId: string
  onClose: () => void
  onImported: (doc: DocumentSummary) => void
}

export default function ImportDialog({ workspaceId, onClose, onImported }: Props) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [dragging, setDragging] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const upload = async (file: File) => {
    setError('')
    setLoading(true)
    try {
      onImported(await documentsApi.import(workspaceId, file))
      onClose()
    } catch (err) {
      setError(apiError(err, 'Import impossible'))
    } finally {
      setLoading(false)
    }
  }

  return (
    <Modal title="Importer un document" onClose={onClose}>
      <div
        onClick={() => inputRef.current?.click()}
        onDragOver={e => { e.preventDefault(); setDragging(true) }}
        onDragLeave={() => setDragging(false)}
        onDrop={e => {
          e.preventDefault()
          setDragging(false)
          const file = e.dataTransfer.files?.[0]
          if (file) upload(file)
        }}
        className={`flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed px-6 py-10 text-center transition-colors ${
          dragging ? 'border-accent bg-accent-soft' : 'border-line-strong hover:border-accent hover:bg-sidebar'
        }`}
      >
        <Upload size={28} className="text-ink-muted" />
        <p className="text-sm font-medium text-ink">
          {loading ? 'Import en cours…' : 'Glissez un fichier ici ou cliquez pour parcourir'}
        </p>
        <p className="text-xs text-ink-muted">Markdown (.md), Word (.docx) ou texte (.txt) — 10 Mo max.</p>
      </div>
      <input
        ref={inputRef}
        type="file"
        accept=".md,.markdown,.docx,.txt"
        className="hidden"
        onChange={e => {
          const file = e.target.files?.[0]
          if (file) upload(file)
          e.target.value = ''
        }}
      />
      {error && <p className="mt-3 rounded-md bg-danger-soft px-3 py-2 text-sm text-danger">{error}</p>}
    </Modal>
  )
}
