import { useEffect, useState } from 'react'
import { Check, Link2, Lock } from 'lucide-react'
import { api } from '../../api/client'
import { apiError } from '../../lib/format'
import { documentUrl } from '../../lib/router'
import { useAuthStore } from '../../store/authStore'
import type { DocumentPermission, DocumentRole, WorkspaceMember } from '../../types'
import { Avatar } from '../ui/Avatar'
import { Button } from '../ui/Button'
import { Modal } from '../ui/Modal'

interface Props {
  docId: string
  docTitle: string
  workspaceId: string
  onClose: () => void
}

type GrantableRole = Exclude<DocumentRole, 'OWNER'>

const ROLES: { value: GrantableRole; label: string }[] = [
  { value: 'EDITOR', label: 'Éditeur' },
  { value: 'COMMENTER', label: 'Commentateur' },
  { value: 'VIEWER', label: 'Lecteur' },
]

// Boîte « Partager » inspirée de Google Docs
export default function ShareDialog({ docId, docTitle, workspaceId, onClose }: Props) {
  const me = useAuthStore(s => s.user)
  const [permissions, setPermissions] = useState<DocumentPermission[]>([])
  const [members, setMembers] = useState<WorkspaceMember[]>([])
  const [email, setEmail] = useState('')
  const [role, setRole] = useState<GrantableRole>('EDITOR')
  const [error, setError] = useState('')
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    api.get(`/api/documents/${docId}/permissions`)
      .then(res => setPermissions(res.data))
      .catch(err => setError(apiError(err, 'Impossible de charger les accès')))
    api.get(`/api/workspaces/${workspaceId}`)
      .then(res => setMembers(res.data.members))
      .catch(() => { /* suggestions facultatives */ })
  }, [docId, workspaceId])

  const suggestions = members.filter(m =>
    m.user.id !== me?.id && !permissions.some(p => p.user.id === m.user.id)
  )

  const invite = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!email.trim()) return
    setError('')
    try {
      const res = await api.post<DocumentPermission>(`/api/documents/${docId}/permissions`, { email: email.trim(), role })
      setPermissions(prev => [...prev.filter(p => p.user.id !== res.data.user.id), res.data])
      setEmail('')
    } catch (err) {
      setError(apiError(err, 'Partage impossible'))
    }
  }

  const changeRole = async (userId: string, value: string) => {
    setError('')
    try {
      if (value === 'REMOVE') {
        await api.delete(`/api/documents/${docId}/permissions/${userId}`)
        setPermissions(prev => prev.filter(p => p.user.id !== userId))
      } else {
        await api.patch(`/api/documents/${docId}/permissions/${userId}`, { role: value })
        setPermissions(prev => prev.map(p => (p.user.id === userId ? { ...p, role: value as DocumentRole } : p)))
      }
    } catch (err) {
      setError(apiError(err, 'Modification impossible'))
    }
  }

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(documentUrl(docId))
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch { /* presse-papiers indisponible */ }
  }

  return (
    <Modal
      title={`Partager « ${docTitle || 'Sans titre'} »`}
      onClose={onClose}
      footer={
        <>
          <Button onClick={copyLink} icon={copied ? <Check size={16} /> : <Link2 size={16} />} className="mr-auto">
            {copied ? 'Lien copié' : 'Copier le lien'}
          </Button>
          <Button variant="primary" onClick={onClose}>OK</Button>
        </>
      }
    >
      <form onSubmit={invite} className="flex gap-2">
        <input
          type="email"
          list="share-suggestions"
          value={email}
          onChange={e => setEmail(e.target.value)}
          placeholder="Ajouter des personnes par e-mail"
          className="h-10 flex-1 rounded-md border border-line-strong px-3 text-sm outline-none focus:border-accent focus:ring-2 focus:ring-accent-soft"
        />
        <datalist id="share-suggestions">
          {suggestions.map(m => <option key={m.user.id} value={m.user.email} />)}
        </datalist>
        <select
          value={role}
          onChange={e => setRole(e.target.value as GrantableRole)}
          className="h-10 rounded-md border border-line-strong bg-white px-2 text-sm"
        >
          {ROLES.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
        </select>
        <Button type="submit" variant="primary" className="h-10">Partager</Button>
      </form>

      {error && <p className="mt-3 rounded-md bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>}

      <h3 className="mb-1 mt-5 text-sm font-medium text-ink">Personnes ayant accès</h3>
      <ul className="-mx-2">
        {me && (
          <li className="flex items-center gap-3 rounded-lg px-2 py-2">
            <Avatar email={me.email} id={me.id} size={32} />
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm text-ink">{me.email} <span className="text-ink-muted">(vous)</span></div>
            </div>
            <span className="px-2 text-sm text-ink-muted">Propriétaire</span>
          </li>
        )}
        {permissions.map(p => (
          <li key={p.user.id} className="flex items-center gap-3 rounded-lg px-2 py-2 hover:bg-hover">
            <Avatar email={p.user.email} id={p.user.id} size={32} />
            <div className="min-w-0 flex-1 truncate text-sm text-ink">{p.user.email}</div>
            <select
              aria-label={`Rôle de ${p.user.email}`}
              value={p.role}
              onChange={e => changeRole(p.user.id, e.target.value)}
              className="h-8 cursor-pointer rounded-md bg-transparent px-2 text-sm text-ink-soft hover:bg-hover"
            >
              {ROLES.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
              <option value="REMOVE">Supprimer l'accès</option>
            </select>
          </li>
        ))}
      </ul>

      <div className="mt-4 flex items-center gap-3 rounded-lg bg-sidebar px-3 py-2.5">
        <span className="flex h-8 w-8 items-center justify-center rounded-full bg-line text-ink-soft"><Lock size={15} /></span>
        <div className="text-xs text-ink-soft">
          <div className="font-medium text-ink">Accès limité</div>
          Seules les personnes ajoutées peuvent ouvrir ce document avec le lien.
        </div>
      </div>
    </Modal>
  )
}
