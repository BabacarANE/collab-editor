import { useEffect, useState } from 'react'
import { RotateCcw } from 'lucide-react'
import { snapshotsApi } from '../../api/endpoints'
import { relativeTime } from '../../lib/format'
import { sanitizeHtml } from '../../lib/sanitize'
import type { Snapshot } from '../../types'
import { Button } from '../ui/Button'
import { Modal } from '../ui/Modal'

interface Props {
  docId: string
  snapshot: Snapshot
  canRestore: boolean
  onRestore: (html: string) => void
  onClose: () => void
}

export default function SnapshotPreviewDialog({ docId, snapshot, canRestore, onRestore, onClose }: Props) {
  const [content, setContent] = useState<string | null>(null)

  useEffect(() => {
    snapshotsApi.get(docId, snapshot.id)
      .then(s => setContent(s.content ?? ''))
      .catch(() => setContent(''))
  }, [docId, snapshot.id])

  const restore = () => {
    if (content === null) return
    if (!confirm('Remplacer le contenu actuel par cette version ? Vos collaborateurs verront le changement immédiatement.')) return
    onRestore(sanitizeHtml(content))
    onClose()
  }

  return (
    <Modal
      title={snapshot.name}
      onClose={onClose}
      width="max-w-3xl"
      footer={canRestore ? (
        <Button variant="primary" icon={<RotateCcw size={15} />} onClick={restore} disabled={content === null}>
          Restaurer cette version
        </Button>
      ) : undefined}
    >
      <p className="-mt-2 mb-3 text-xs text-ink-muted">
        Enregistrée {relativeTime(snapshot.createdAt)} par {snapshot.author.email}
      </p>
      <div className="max-h-[55vh] overflow-y-auto rounded-lg border border-line bg-white">
        {content === null ? (
          <p className="p-6 text-sm text-ink-muted">Chargement…</p>
        ) : (
          <div className="ProseMirror document-preview" dangerouslySetInnerHTML={{ __html: sanitizeHtml(content) }} />
        )}
      </div>
    </Modal>
  )
}
