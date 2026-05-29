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

  // Charger les workspaces au montage
  useEffect(() => {
    api.get('/api/workspaces')
      .then(res => {
        setWorkspaces(res.data)
        // Sélectionner automatiquement le premier workspace
        if (res.data.length > 0) {
          setActiveWorkspace(res.data[0])
        }
      })
      .catch(() => setError('Erreur chargement workspaces'))
  }, [])

  // Charger les documents quand un workspace est sélectionné
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
      const res = await api.post('/api/documents', {
        title,
        workspaceId: activeWorkspace.id
      })
      setDocuments(prev => [res.data, ...prev])
      setNewDocTitle('')
    } catch {
      setError('Erreur création document')
    }
  }

  return (
    <div style={{ display: 'flex', height: '100vh', fontFamily: 'sans-serif' }}>

      {/* Sidebar gauche — Workspaces */}
      <div style={{ width: 240, borderRight: '1px solid #eee', padding: 16, display: 'flex', flexDirection: 'column', gap: 8 }}>
        <div style={{ fontWeight: 'bold', marginBottom: 8 }}>👤 {user?.email}</div>
        <hr />
        <div style={{ fontWeight: 600, fontSize: 13, color: '#666' }}>WORKSPACES</div>

        {workspaces.map(ws => (
          <button
            key={ws.id}
            onClick={() => setActiveWorkspace(ws)}
            style={{
              padding: '8px 12px',
              textAlign: 'left',
              border: 'none',
              borderRadius: 6,
              cursor: 'pointer',
              background: activeWorkspace?.id === ws.id ? '#e8f0fe' : 'transparent',
              fontWeight: activeWorkspace?.id === ws.id ? 600 : 400
            }}
          >
            📁 {ws.name}
          </button>
        ))}

        {/* Créer un workspace */}
        <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 4 }}>
          <input
            placeholder="Nouveau workspace..."
            value={newWorkspaceName}
            onChange={e => setNewWorkspaceName(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && createWorkspace()}
            style={{ padding: '6px 8px', fontSize: 13, borderRadius: 4, border: '1px solid #ddd' }}
          />
          <button
            onClick={createWorkspace}
            style={{ padding: '6px 8px', fontSize: 13, cursor: 'pointer', borderRadius: 4, border: '1px solid #ddd' }}
          >
            + Créer
          </button>
        </div>

        {/* Déconnexion en bas */}
        <div style={{ marginTop: 'auto' }}>
          <button
            onClick={logout}
            style={{ width: '100%', padding: 8, cursor: 'pointer', background: 'none', border: '1px solid #ddd', borderRadius: 4, color: '#666' }}
          >
            Déconnexion
          </button>
        </div>
      </div>

      {/* Zone principale — Documents */}
      <div style={{ flex: 1, padding: 32 }}>
        {!activeWorkspace ? (
          <div style={{ color: '#999', marginTop: 80, textAlign: 'center' }}>
            <p style={{ fontSize: 18 }}>Crée ou sélectionne un workspace pour commencer</p>
          </div>
        ) : (
          <>
            <h2 style={{ marginTop: 0 }}>📁 {activeWorkspace.name}</h2>

            {/* Créer un document */}
            <div style={{ display: 'flex', gap: 8, marginBottom: 24 }}>
              <input
                placeholder="Titre du document..."
                value={newDocTitle}
                onChange={e => setNewDocTitle(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && createDocument()}
                style={{ padding: '8px 12px', fontSize: 14, borderRadius: 4, border: '1px solid #ddd', flex: 1 }}
              />
              <button
                onClick={createDocument}
                style={{ padding: '8px 16px', fontSize: 14, cursor: 'pointer', borderRadius: 4, border: 'none', background: '#1a73e8', color: 'white' }}
              >
                + Nouveau document
              </button>
            </div>

            {error && <p style={{ color: 'red' }}>{error}</p>}

            {/* Liste des documents */}
            {loading ? (
              <p style={{ color: '#999' }}>Chargement...</p>
            ) : documents.length === 0 ? (
              <p style={{ color: '#999' }}>Aucun document dans ce workspace.</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {documents.map(doc => (
                  <div
                    key={doc.id}
                    onClick={() => onOpenDocument(doc.id)}
                    style={{
                      padding: '12px 16px',
                      border: '1px solid #eee',
                      borderRadius: 8,
                      cursor: 'pointer',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      background: '#fafafa'
                    }}
                  >
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