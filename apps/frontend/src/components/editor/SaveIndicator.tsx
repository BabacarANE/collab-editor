import { CloudOff, Loader2 } from 'lucide-react'
import type { ConnectionStatus } from '../../hooks/useCollaboration'
import type { SaveStatus } from '../../hooks/useAutosave'
import { relativeTime } from '../../lib/format'

interface Props {
  connection: ConnectionStatus
  saveStatus: SaveStatus
  canEdit: boolean
  updatedAt?: string
}

const SAVE_LABELS: Record<SaveStatus, string> = {
  saved: 'Toutes les modifications ont été enregistrées',
  saving: 'Enregistrement…',
  unsaved: 'Modifications non enregistrées',
  error: 'Échec de l\'enregistrement — nouvel essai à la prochaine modification',
}

export default function SaveIndicator({ connection, saveStatus, canEdit, updatedAt }: Props) {
  const base = 'hidden shrink-0 items-center gap-1.5 text-xs md:flex'
  if (connection === 'disconnected') {
    return <span className={`${base} text-amber-600`}><CloudOff size={14} /> Hors ligne — modifications conservées localement</span>
  }
  if (connection === 'connecting') {
    return <span className={`${base} text-ink-muted`}><Loader2 size={14} className="animate-spin" /> Connexion…</span>
  }
  if (!canEdit) {
    return updatedAt ? <span className={`${base} text-ink-muted`}>Modifié {relativeTime(updatedAt)}</span> : null
  }
  return <span className={`${base} ${saveStatus === 'error' ? 'text-red-600' : 'text-ink-muted'}`}>{SAVE_LABELS[saveStatus]}</span>
}
