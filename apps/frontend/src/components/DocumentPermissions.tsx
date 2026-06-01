// apps/frontend/src/components/DocumentPermissions.tsx
import { useState, useEffect } from 'react'
import { api } from '../api/client'

interface Permission {
  role: string
  grantedAt: string
  user: { id: string; email: string }
}

interface Props {
  docId: string
  docTitle: string
  workspaceId: string
  onClose: () => void

}

const ROLE_LABELS: Record<string, { label: string; description: string; color: string }> = {
  EDITOR:    { label: 'Éditeur',    description: 'Peut lire et modifier',           color: '#1a73e8' },
  COMMENTER: { label: 'Commentateur', description: 'Peut lire et commenter',        color: '#f59e0b' },
  VIEWER:    { label: 'Lecteur',    description: 'Lecture seule',                   color: '#6b7280' },
}

export default function DocumentPermissions({ docId, docTitle, workspaceId, onClose }: Props) {
  const [permissions, setPermissions] = useState<Permission[]>([])
  const [loading, setLoading] = useState(true)
  const [email, setEmail] = useState('')
  const [role, setRole] = useState('EDITOR')
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [members, setMembers] = useState<{ user: { id: string; email: string } }[]>([])
  

  useEffect(() => {
    api.get(`/api/workspaces/${workspaceId}`).then(res => setMembers(res.data.members))
  }, [workspaceId])

  const load = async () => {
    setLoading(true)
    try {
      const res = await api.get(`/api/documents/${docId}/permissions`)
      setPermissions(res.data)
    } catch {
      setError('Erreur chargement permissions')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [docId])

  const invite = async () => {
    if (!email.trim()) return
    setError('')
    setSuccess('')
    try {
      const res = await api.post(`/api/documents/${docId}/permissions`, {
        email: email.trim(),
        role
      })
      setPermissions(prev => {
        const exists = prev.find(p => p.user.id === res.data.user.id)
        if (exists) return prev.map(p => p.user.id === res.data.user.id ? res.data : p)
        return [...prev, res.data]
      })
      setSuccess(`${email} a accès en tant que ${ROLE_LABELS[role].label}`)
      setEmail('')
    } catch (e: any) {
      setError(e.response?.data?.error ?? 'Erreur invitation')
    }
  }


  const changeRole = async (targetUserId: string, newRole: string) => {
    try {
      await api.patch(`/api/documents/${docId}/permissions/${targetUserId}`, { role: newRole })
      setPermissions(prev => prev.map(p =>
        p.user.id === targetUserId ? { ...p, role: newRole } : p
      ))
    } catch {
      setError('Erreur changement de rôle')
    }
  }

  const remove = async (targetUserId: string, targetEmail: string) => {
    if (!confirm(`Retirer l'accès à ${targetEmail} ?`)) return
    try {
      await api.delete(`/api/documents/${docId}/permissions/${targetUserId}`)
      setPermissions(prev => prev.filter(p => p.user.id !== targetUserId))
    } catch {
      setError('Erreur suppression')
    }
  }

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 200
    }}>
      <div style={{
        background: 'white', borderRadius: 12, padding: 24,
        width: 480, maxHeight: '80vh', overflow: 'auto',
        display: 'flex', flexDirection: 'column', gap: 16
      }}>
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h3 style={{ margin: 0, fontSize: 16 }}>🔐 Partage du document</h3>
            <div style={{ fontSize: 12, color: '#999', marginTop: 2 }}>📄 {docTitle}</div>
          </div>
          <button onClick={onClose}
            style={{ background: 'none', border: 'none', fontSize: 18, cursor: 'pointer', color: '#666' }}>✕</button>
        </div>



        {/* Inviter */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, padding: 14, background: '#f8f9fa', borderRadius: 8 }}>
          <div style={{ fontSize: 13, fontWeight: 600 }}>Inviter une personne</div>
          <div style={{ display: 'flex', gap: 8 }}>
            <input
              placeholder="email@exemple.com"
              value={email}
              onChange={e => setEmail(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && invite()}
              style={{ flex: 1, padding: '8px 10px', borderRadius: 6, border: '1px solid #ddd', fontSize: 13 }}
            />

            <input
              placeholder="email@exemple.com"
              value={email}
              onChange={e => setEmail(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && invite()}
              list="members-list"
              style={{ flex: 1, padding: '8px 10px', borderRadius: 6, border: '1px solid #ddd', fontSize: 13 }}
            />
            <datalist id="members-list">
              {members.map(m => (
                <option key={m.user.id} value={m.user.email} />
              ))}
            </datalist>

            <select value={role} onChange={e => setRole(e.target.value)}
              style={{ padding: '8px 10px', borderRadius: 6, border: '1px solid #ddd', fontSize: 13 }}>
              {Object.entries(ROLE_LABELS).map(([key, val]) => (
                <option key={key} value={key}>{val.label}</option>
              ))}
            </select>
            <button onClick={invite}
              style={{ padding: '8px 14px', background: '#1a73e8', color: 'white', border: 'none', borderRadius: 6, cursor: 'pointer', fontSize: 13 }}>
              Inviter
            </button>
          </div>
          {error && <p style={{ color: '#ef4444', fontSize: 12, margin: 0 }}>{error}</p>}
          {success && <p style={{ color: '#10b981', fontSize: 12, margin: 0 }}>✓ {success}</p>}
        </div>

        {/* Légende des rôles */}
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {Object.entries(ROLE_LABELS).map(([key, val]) => (
            <div key={key} style={{ fontSize: 11, color: '#666' }}>
              <span style={{ color: val.color, fontWeight: 600 }}>{val.label}</span>
              {' '}— {val.description}
            </div>
          ))}
        </div>

        {/* Liste des permissions */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: '#666' }}>
            Personnes ayant accès ({permissions.length})
          </div>

          {loading ? (
            <p style={{ color: '#999', fontSize: 13 }}>Chargement...</p>
          ) : permissions.length === 0 ? (
            <p style={{ color: '#999', fontSize: 13 }}>Aucun accès partagé pour l'instant</p>
          ) : (
            permissions.map(p => (
              <div key={p.user.id} style={{
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                padding: '10px 12px', border: '1px solid #eee', borderRadius: 8, background: '#fafafa'
              }}>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 500 }}>{p.user.email}</div>
                  <div style={{ fontSize: 11, color: '#bbb', marginTop: 2 }}>
                    Depuis le {new Date(p.grantedAt).toLocaleDateString('fr-FR')}
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <select
                    value={p.role}
                    onChange={e => changeRole(p.user.id, e.target.value)}
                    style={{
                      padding: '4px 8px', borderRadius: 4, fontSize: 12,
                      border: '1px solid #ddd',
                      color: ROLE_LABELS[p.role]?.color ?? '#666'
                    }}
                  >
                    {Object.entries(ROLE_LABELS).map(([key, val]) => (
                      <option key={key} value={key}>{val.label}</option>
                    ))}
                  </select>
                  <button onClick={() => remove(p.user.id, p.user.email)}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#ef4444', fontSize: 13 }}>
                    Retirer
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  )
}
