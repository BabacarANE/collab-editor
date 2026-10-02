import { useEffect, useState } from 'react'
import { UserMinus } from 'lucide-react'
import { api } from '../../api/client'
import { apiError } from '../../lib/format'
import { useAuthStore } from '../../store/authStore'
import type { Workspace, WorkspaceMember, WorkspaceRole } from '../../types'
import { Avatar } from '../ui/Avatar'
import { Button } from '../ui/Button'
import { Modal } from '../ui/Modal'

interface Props {
  workspace: Workspace
  onClose: () => void
}

export default function MembersDialog({ workspace, onClose }: Props) {
  const me = useAuthStore(s => s.user)
  const [members, setMembers] = useState<WorkspaceMember[]>([])
  const [email, setEmail] = useState('')
  const [role, setRole] = useState<WorkspaceRole>('MEMBER')
  const [error, setError] = useState('')
  const isAdmin = workspace.role === 'ADMIN'

  useEffect(() => {
    api.get(`/api/workspaces/${workspace.id}`)
      .then(res => setMembers(res.data.members))
      .catch(() => setError('Impossible de charger les membres'))
  }, [workspace.id])

  const invite = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!email.trim()) return
    setError('')
    try {
      const res = await api.post(`/api/workspaces/${workspace.id}/members`, { email: email.trim(), role })
      setMembers(prev => [...prev, res.data])
      setEmail('')
    } catch (err) {
      setError(apiError(err, 'Invitation impossible'))
    }
  }

  const remove = async (userId: string) => {
    setError('')
    try {
      await api.delete(`/api/workspaces/${workspace.id}/members/${userId}`)
      setMembers(prev => prev.filter(m => m.user.id !== userId))
    } catch (err) {
      setError(apiError(err, 'Suppression impossible'))
    }
  }

  return (
    <Modal title={`Membres de « ${workspace.name} »`} onClose={onClose} footer={<Button variant="primary" onClick={onClose}>Terminé</Button>}>
      {isAdmin && (
        <form onSubmit={invite} className="mb-4 flex gap-2">
          <input
            type="email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            placeholder="Adresse e-mail"
            className="h-9 flex-1 rounded-md border border-line-strong px-3 text-sm outline-none focus:border-accent focus:ring-2 focus:ring-accent-soft"
          />
          <select
            value={role}
            onChange={e => setRole(e.target.value as WorkspaceRole)}
            className="h-9 rounded-md border border-line-strong bg-white px-2 text-sm"
          >
            <option value="MEMBER">Membre</option>
            <option value="ADMIN">Admin</option>
          </select>
          <Button type="submit" variant="primary">Inviter</Button>
        </form>
      )}

      {error && <p className="mb-3 rounded-md bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>}

      <ul className="-mx-2">
        {members.map(m => (
          <li key={m.user.id} className="group flex items-center gap-3 rounded-lg px-2 py-2 hover:bg-hover">
            <Avatar email={m.user.email} id={m.user.id} size={32} />
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm text-ink">
                {m.user.email} {m.user.id === me?.id && <span className="text-ink-muted">(vous)</span>}
              </div>
              <div className="text-xs text-ink-muted">{m.role === 'ADMIN' ? 'Administrateur' : 'Membre'}</div>
            </div>
            {isAdmin && m.user.id !== me?.id && (
              <button
                onClick={() => remove(m.user.id)}
                title="Retirer du workspace"
                className="rounded-md p-1.5 text-ink-muted opacity-0 hover:bg-red-50 hover:text-red-600 group-hover:opacity-100 cursor-pointer"
              >
                <UserMinus size={16} />
              </button>
            )}
          </li>
        ))}
      </ul>
    </Modal>
  )
}
