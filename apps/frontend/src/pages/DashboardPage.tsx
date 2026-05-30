import { useEffect, useState } from 'react'
import { api } from '../api/client'
import { useAuthStore } from '../store/authStore'

interface Workspace {
  id: string
  name: string
  createdAt: string
  role: string
}

interface Document {
  id: string
  title: string
  updatedAt: string
}

interface Member {
  role: string
  user: { id: string; email: string }
}

interface Props {
  onOpenDocument: (docId: string) => void
}

export default function DashboardPage({ onOpenDocument }: Props) {
  const user = useAuthStore((s) => s.user)
  const logout = useAuthStore((s) => s.logout)

  const [workspaces, setWorkspaces] = useState<Workspace[]>([])
  const [activeWorkspace, setActiveWorkspace] = useState<Workspace | null>(null)
  const [documents, setDocuments] = useState<Document[]>([])
  const [newWorkspaceName, setNewWorkspaceName] = useState('')
  const [newDocTitle, setNewDocTitle] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  // Modal membres
  const [showMembers, setShowMembers] = useState(false)
  const [members, setMembers] = useState<Member[]>([])
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteError, setInviteError] = useState('')
  const [inviteSuccess, setInviteSuccess] = useState('')

  useEffect(() => {
    api.get('/api/workspaces')
      .then(res => {
        setWorkspaces(res.data)
        if (res.data.length > 0) setActiveWorkspace(res.data[0])
      })
      .catch(() => setError('Erreur chargement workspaces'))
  }, [])

  useEffect(() => {
    if (!activeWorkspace) return
    setLoading(true)
    setDocuments([])
    api.get(`/api/documents/workspace/${activeWorkspace.id}`)
      .then(res => setDocuments(res.data))
      .catch(() => setError('Erreur chargement documents'))
      .finally(() => setLoading(false))
  }, [activeWorkspace])

  const createWorkspace = async () => {
    if (!newWorkspaceName.trim()) return
    try {
      const res = await api.post('/api/workspaces', { name: newWorkspaceName.trim() })
      const ws = res.data as Workspace
      setWorkspaces(prev => [...prev, ws])
      setActiveWorkspace(ws)
      setNewWorkspaceName('')
    } catch {
      setError('Erreur création workspace')
    }
  }

  const createDocument = async () => {
    if (!activeWorkspace) return
    const title = newDocTitle.trim() || 'Sans titre'
    try {
      const res = await api.post('/api/documents', { title, workspaceId: activeWorkspace.id })
      setDocuments(prev => [res.data, ...prev])
      setNewDocTitle('')
    } catch {
      setError('Erreur création document')
    }
  }

  const openMembers = async () => {
    if (!activeWorkspace) return
    try {
      const res = await api.get(`/api/workspaces/${activeWorkspace.id}`)
      setMembers(res.data.members)
      setInviteEmail('')
      setInviteError('')
      setInviteSuccess('')
      setShowMembers(true)
    } catch {
      setError('Erreur chargement membres')
    }
  }

  const inviteMember = async () => {
    if (!activeWorkspace || !inviteEmail.trim()) return
    setInviteError('')
    setInviteSuccess('')
    try {
      const res = await api.post(`/api/workspaces/${activeWorkspace.id}/members`, {
        email: inviteEmail.trim(),
        role: 'MEMBER'
      })
      setMembers(prev => [...prev, res.data])
      setInviteSuccess(`${inviteEmail} a été invité`)
      setInviteEmail('')
    } catch (e: any) {
      setInviteError(e.response?.data?.error ?? 'Erreur invitation')
    }
  }

  const removeMember = async (memberId: string) => {
    if (!activeWorkspace) return
    try {
      await api.delete(`/api/workspaces/${activeWorkspace.id}/members/${memberId}`)
      setMembers(prev => prev.filter(m => m.user.id !== memberId))
    } catch (e: any) {
      setInviteError(e.response?.data?.error ?? 'Erreur suppression')
    }
  }

  return (
    <div style={{ display: 'flex', height: '100vh', fontFamily: 'sans-serif' }}>

      {/* Modal membres */}
      {showMembers && activeWorkspace && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100
        }}>
          <div style={{
            background: 'white', borderRadius: 12, padding: 24,
            width: 420, maxHeight: '80vh', overflow: 'auto',
            display: 'flex', flexDirection: 'column', gap: 16
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ margin: 0 }}>👥 Membres — {activeWorkspace.name}</h3>
              <button onClick={() => setShowMembers(false)}
                style={{ background: 'none', border: 'none', fontSize: 18, cursor: 'pointer', color: '#666' }}>
                ✕
              </button>
            </div>

            {/* Liste des membres */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {members.map(m => (
                <div key={m.user.id} style={{
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  padding: '8px 12px', border: '1px solid #eee', borderRadius: 8
                }}>
                  <div>
                    <span style={{ fontWeight: 500 }}>{m.user.email}</span>
                    <span style={{
                      marginLeft: 8, fontSize: 11, padding: '2px 6px',
                      borderRadius: 4, background: m.role === 'ADMIN' ? '#e8f0fe' : '#f1f3f4',
                      color: m.role === 'ADMIN' ? '#1a73e8' : '#666'
                    }}>
                      {m.role}
                    </span>
                  </div>
                  {/* Ne pas pouvoir se retirer soi-même */}
                  {m.user.id !== user?.id && activeWorkspace.role === 'ADMIN' && (
                    <button onClick={() => removeMember(m.user.id)}
                      style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#ef4444', fontSize: 13 }}>
                      Retirer
                    </button>
                  )}
                </div>
              ))}
            </div>

            {/* Inviter un membre — seulement si ADMIN */}
            {activeWorkspace.role === 'ADMIN' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, borderTop: '1px solid #eee', paddingTop: 16 }}>
                <div style={{ fontWeight: 600, fontSize: 13 }}>Inviter par email</div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <input
                    placeholder="email@exemple.com"
                    value={inviteEmail}
                    onChange={e => setInviteEmail(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && inviteMember()}
                    style={{ flex: 1, padding: '8px 12px', borderRadius: 4, border: '1px solid #ddd', fontSize: 14 }}
                  />
                  <button onClick={inviteMember}
                    style={{ padding: '8px 16px', background: '#1a73e8', color: 'white', border: 'none', borderRadius: 4, cursor: 'pointer' }}>
                    Inviter
                  </button>
                </div>
                {inviteError && <p style={{ color: '#ef4444', margin: 0, fontSize: 13 }}>{inviteError}</p>}
                {inviteSuccess && <p style={{ color: '#10b981', margin: 0, fontSize: 13 }}>✓ {inviteSuccess}</p>}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Sidebar */}
      <div style={{ width: 240, borderRight: '1px solid #eee', padding: 16, display: 'flex', flexDirection: 'column', gap: 8 }}>
        <div style={{ fontWeight: 'bold', marginBottom: 8 }}>👤 {user?.email}</div>
        <hr />
        <div style={{ fontWeight: 600, fontSize: 13, color: '#666' }}>WORKSPACES</div>

        {workspaces.map(ws => (
          <button key={ws.id} onClick={() => setActiveWorkspace(ws)}
            style={{
              padding: '8px 12px', textAlign: 'left', border: 'none', borderRadius: 6, cursor: 'pointer',
              background: activeWorkspace?.id === ws.id ? '#e8f0fe' : 'transparent',
              fontWeight: activeWorkspace?.id === ws.id ? 600 : 400
            }}>
            📁 {ws.name}
          </button>
        ))}

        <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 4 }}>
          <input placeholder="Nouveau workspace..." value={newWorkspaceName}
            onChange={e => setNewWorkspaceName(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && createWorkspace()}
            style={{ padding: '6px 8px', fontSize: 13, borderRadius: 4, border: '1px solid #ddd' }} />
          <button onClick={createWorkspace}
            style={{ padding: '6px 8px', fontSize: 13, cursor: 'pointer', borderRadius: 4, border: '1px solid #ddd' }}>
            + Créer
          </button>
        </div>

        <div style={{ marginTop: 'auto' }}>
          <button onClick={logout}
            style={{ width: '100%', padding: 8, cursor: 'pointer', background: 'none', border: '1px solid #ddd', borderRadius: 4, color: '#666' }}>
            Déconnexion
          </button>
        </div>
      </div>

      {/* Zone principale */}
      <div style={{ flex: 1, padding: 32 }}>
        {!activeWorkspace ? (
          <div style={{ color: '#999', marginTop: 80, textAlign: 'center' }}>
            <p style={{ fontSize: 18 }}>Crée ou sélectionne un workspace pour commencer</p>
          </div>
        ) : (
          <>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
              <h2 style={{ margin: 0 }}>📁 {activeWorkspace.name}</h2>
              <button onClick={openMembers}
                style={{ padding: '8px 16px', fontSize: 14, cursor: 'pointer', borderRadius: 4, border: '1px solid #ddd', background: 'white' }}>
                👥 Membres
              </button>
            </div>

            <div style={{ display: 'flex', gap: 8, marginBottom: 24 }}>
              <input placeholder="Titre du document..." value={newDocTitle}
                onChange={e => setNewDocTitle(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && createDocument()}
                style={{ padding: '8px 12px', fontSize: 14, borderRadius: 4, border: '1px solid #ddd', flex: 1 }} />
              <button onClick={createDocument}
                style={{ padding: '8px 16px', fontSize: 14, cursor: 'pointer', borderRadius: 4, border: 'none', background: '#1a73e8', color: 'white' }}>
                + Nouveau document
              </button>
            </div>

            {error && <p style={{ color: 'red' }}>{error}</p>}

            {loading ? (
              <p style={{ color: '#999' }}>Chargement...</p>
            ) : documents.length === 0 ? (
              <p style={{ color: '#999' }}>Aucun document dans ce workspace.</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {documents.map(doc => (
                  <div key={doc.id} onClick={() => onOpenDocument(doc.id)}
                    style={{
                      padding: '12px 16px', border: '1px solid #eee', borderRadius: 8, cursor: 'pointer',
                      display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#fafafa'
                    }}>
                    <span style={{ fontWeight: 500 }}>📄 {doc.title}</span>
                    <span style={{ fontSize: 12, color: '#999' }}>
                      {new Date(doc.updatedAt).toLocaleDateString('fr-FR')}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}