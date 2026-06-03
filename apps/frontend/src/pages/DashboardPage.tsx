import { useEffect, useState } from 'react'
import { api } from '../api/client'
import { useAuthStore } from '../store/authStore'
import ImportButton from '../components/ImportButton'
import SearchBar from '../components/SearchBar'
import NotificationBell from '../components/NotificationBell'

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
  onOpenDocument: (docId: string, workspaceId: string) => void
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
  const [inviteRole, setInviteRole] = useState('MEMBER')
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
        role: inviteRole
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
    <div className="flex h-screen bg-gray-50 font-sans">

      {/* Modal membres */}
      {showMembers && activeWorkspace && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 w-[440px] max-h-[80vh] overflow-auto flex flex-col gap-4 shadow-xl">
            <div className="flex justify-between items-center">
              <div>
                <h3 className="font-semibold text-gray-800">👥 Membres</h3>
                <p className="text-xs text-gray-400 mt-0.5">{activeWorkspace.name}</p>
              </div>
              <button onClick={() => setShowMembers(false)}
                className="text-gray-400 hover:text-gray-700 text-lg cursor-pointer">✕</button>
            </div>

            {/* Liste membres */}
            <div className="flex flex-col gap-2">
              {members.map((m: { role: string; user: { id: string; email: string } }) => (
                <div key={m.user.id}
                  className="flex justify-between items-center px-3 py-2.5 border border-gray-100 rounded-lg bg-gray-50">
                  <div>
                    <span className="text-sm font-medium text-gray-800">{m.user.email}</span>
                    <span className={`ml-2 text-xs px-1.5 py-0.5 rounded font-medium ${
                      m.role === 'ADMIN'
                        ? 'bg-blue-100 text-blue-700'
                        : 'bg-gray-100 text-gray-500'
                    }`}>
                      {m.role}
                    </span>
                  </div>
                  {m.user.id !== user?.id && activeWorkspace.role === 'ADMIN' && (
                    <button onClick={() => removeMember(m.user.id)}
                      className="text-xs text-red-500 hover:text-red-700 cursor-pointer">
                      Retirer
                    </button>
                  )}
                </div>
              ))}
            </div>

            {/* Inviter */}
            {activeWorkspace.role === 'ADMIN' && (
              <div className="flex flex-col gap-3 border-t border-gray-100 pt-4">
                <span className="text-sm font-medium text-gray-700">Inviter par email</span>
                <div className="flex gap-2">
                  <input
                    placeholder="email@exemple.com"
                    value={inviteEmail}
                    onChange={e => setInviteEmail(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && inviteMember()}
                    className="flex-1 px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:border-blue-400"
                  />
                  <select
                    value={inviteRole}
                    onChange={e => setInviteRole(e.target.value)}
                    className="px-2 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:border-blue-400"
                  >
                    <option value="MEMBER">Membre</option>
                    <option value="ADMIN">Admin</option>
                  </select>
                  <button onClick={inviteMember}
                    className="px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 cursor-pointer">
                    Inviter
                  </button>
                </div>
                {inviteError && <p className="text-xs text-red-500">{inviteError}</p>}
                {inviteSuccess && <p className="text-xs text-emerald-500">✓ {inviteSuccess}</p>}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Sidebar */}
      <aside className="w-56 bg-white border-r border-gray-200 flex flex-col">
        {/* User */}
        <div className="px-4 py-4 border-b border-gray-100">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-full bg-blue-600 flex items-center justify-center text-white text-xs font-semibold">
              {user?.email?.charAt(0).toUpperCase()}
            </div>
            <span className="text-xs text-gray-600 truncate">{user?.email}</span>
          </div>
        </div>

        {/* Workspaces */}
        <div className="flex-1 overflow-y-auto px-2 py-3">
          <div className="text-xs font-semibold text-gray-400 uppercase tracking-wider px-2 mb-2">
            Espaces de travail
          </div>
          <div className="flex flex-col gap-0.5">
            {workspaces.map(ws => (
              <button
                key={ws.id}
                onClick={() => setActiveWorkspace(ws)}
                className={`w-full text-left px-3 py-2 text-sm rounded-lg transition-colors cursor-pointer flex items-center gap-2 ${
                  activeWorkspace?.id === ws.id
                    ? 'bg-blue-50 text-blue-700 font-medium'
                    : 'text-gray-600 hover:bg-gray-100'
                }`}
              >
                <span className="text-base">📁</span>
                <span className="truncate">{ws.name}</span>
              </button>
            ))}
          </div>

          {/* Créer workspace */}
          <div className="mt-3 px-1 flex flex-col gap-1.5">
            <input
              placeholder="Nouveau workspace..."
              value={newWorkspaceName}
              onChange={e => setNewWorkspaceName(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && createWorkspace()}
              className="px-2.5 py-1.5 text-xs border border-gray-200 rounded-lg focus:outline-none focus:border-blue-400 w-full"
            />
            <button
              onClick={createWorkspace}
              className="w-full py-1.5 text-xs border border-gray-200 rounded-lg hover:bg-gray-50 text-gray-600 cursor-pointer"
            >
              + Créer
            </button>
          </div>
        </div>

        {/* Déconnexion */}
        <div className="px-3 py-3 border-t border-gray-100">
          <button
            onClick={logout}
            className="w-full py-2 text-sm text-gray-500 hover:text-gray-800 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors cursor-pointer"
          >
            Déconnexion
          </button>
        </div>
      </aside>

      {/* Zone principale */}
      <main className="flex-1 flex flex-col overflow-hidden">

        {/* Header principal */}
        <div className="px-8 py-4 bg-white border-b border-gray-200 flex items-center justify-between">
          {activeWorkspace ? (
            <>
              <div className="flex items-center gap-3">
                <span className="text-lg">📁</span>
                <h2 className="font-semibold text-gray-800">{activeWorkspace.name}</h2>
                <span className={`text-xs px-2 py-0.5 rounded font-medium ${
                  activeWorkspace.role === 'ADMIN'
                    ? 'bg-blue-100 text-blue-700'
                    : 'bg-gray-100 text-gray-500'
                }`}>
                  {activeWorkspace.role}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <SearchBar
                  workspaceId={activeWorkspace.id}
                  onOpenDocument={(docId) => onOpenDocument(docId, activeWorkspace.id)}
                />
                <NotificationBell onOpenDocument={(docId) => onOpenDocument(docId, activeWorkspace?.id ?? '')} />
                <button
                  onClick={openMembers}
                  className="flex items-center gap-1.5 px-3 py-2 text-sm border border-gray-200 rounded-lg hover:bg-gray-50 text-gray-600 cursor-pointer"
                >
                  👥 Membres
                </button>
              </div>
            </>
          ) : (
            <h2 className="font-semibold text-gray-500">Sélectionne un workspace</h2>
          )}
        </div>

        {/* Contenu */}
        <div className="flex-1 overflow-y-auto px-8 py-6">
          {!activeWorkspace ? (
            <div className="flex flex-col items-center justify-center h-full text-center">
              <div className="text-5xl mb-4">📁</div>
              <p className="text-gray-500 text-lg font-medium">Aucun workspace sélectionné</p>
              <p className="text-gray-400 text-sm mt-1">Crée ou sélectionne un workspace dans la sidebar</p>
            </div>
          ) : (
            <>
              {/* Actions */}
              <div className="flex gap-3 mb-6">
                <input
                  placeholder="Titre du document..."
                  value={newDocTitle}
                  onChange={e => setNewDocTitle(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && createDocument()}
                  className="flex-1 px-4 py-2.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100 bg-white"
                />
                <button
                  onClick={createDocument}
                  className="px-4 py-2.5 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors cursor-pointer"
                >
                  + Nouveau document
                </button>
              </div>

              {/* Import */}
              <div className="mb-6">
                <ImportButton
                  workspaceId={activeWorkspace.id}
                  onImported={(doc) => setDocuments(prev => [doc, ...prev])}
                />
              </div>

              {error && (
                <div className="mb-4 px-4 py-2.5 bg-red-50 border border-red-200 rounded-lg text-sm text-red-600">
                  {error}
                </div>
              )}

              {/* Liste documents */}
              {loading ? (
                <div className="flex items-center justify-center py-12">
                  <div className="text-gray-400 text-sm">Chargement...</div>
                </div>
              ) : documents.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 text-center">
                  <div className="text-4xl mb-3">📄</div>
                  <p className="text-gray-500 font-medium">Aucun document</p>
                  <p className="text-gray-400 text-sm mt-1">Crée ton premier document ci-dessus</p>
                </div>
              ) : (
                <div className="grid gap-2">
                  {documents.map(doc => (
                    <div
                      key={doc.id}
                      onClick={() => onOpenDocument(doc.id, activeWorkspace.id)}
                      className="flex items-center justify-between px-5 py-3.5 bg-white border border-gray-200 rounded-lg cursor-pointer hover:border-blue-300 hover:shadow-sm transition-all group"
                    >
                      <div className="flex items-center gap-3">
                        <span className="text-gray-400 group-hover:text-blue-500 transition-colors">📄</span>
                        <span className="text-sm font-medium text-gray-800">{doc.title}</span>
                      </div>
                      <span className="text-xs text-gray-400">
                        {new Date(doc.updatedAt).toLocaleDateString('fr-FR', {
                          day: 'numeric', month: 'short', year: 'numeric'
                        })}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      </main>
    </div>
  )
}