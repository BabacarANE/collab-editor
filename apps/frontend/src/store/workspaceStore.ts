import { create } from 'zustand'
import { api } from '../api/client'
import { safeStorage } from '../lib/format'
import type { DocumentSummary, Workspace } from '../types'

const ACTIVE_KEY = 'collab:active-workspace'
const storage = safeStorage()

interface WorkspaceState {
  workspaces: Workspace[]
  activeWorkspaceId: string | null
  documents: DocumentSummary[]
  loadingDocuments: boolean
  error: string | null

  loadWorkspaces: () => Promise<void>
  selectWorkspace: (id: string) => Promise<void>
  createWorkspace: (name: string) => Promise<Workspace>
  loadDocuments: () => Promise<void>
  createDocument: (title?: string) => Promise<DocumentSummary>
  addDocument: (doc: DocumentSummary) => void
  updateDocumentLocally: (id: string, patch: Partial<DocumentSummary>) => void
  deleteDocument: (id: string) => Promise<void>
  reset: () => void
}

export const useWorkspaceStore = create<WorkspaceState>()((set, get) => ({
  workspaces: [],
  activeWorkspaceId: null,
  documents: [],
  loadingDocuments: false,
  error: null,

  loadWorkspaces: async () => {
    const res = await api.get<Workspace[]>('/api/workspaces')
    const workspaces = res.data
    const remembered = storage.get(ACTIVE_KEY)
    const current = get().activeWorkspaceId
    const active =
      workspaces.find(w => w.id === current) ??
      workspaces.find(w => w.id === remembered) ??
      workspaces[0] ??
      null
    set({ workspaces, activeWorkspaceId: active?.id ?? null })
    if (active) await get().loadDocuments()
  },

  selectWorkspace: async (id) => {
    if (id === get().activeWorkspaceId) return
    storage.set(ACTIVE_KEY, id)
    set({ activeWorkspaceId: id, documents: [] })
    await get().loadDocuments()
  },

  createWorkspace: async (name) => {
    const res = await api.post('/api/workspaces', { name })
    const workspace: Workspace = { ...res.data, role: 'ADMIN' }
    set(state => ({ workspaces: [...state.workspaces, workspace] }))
    await get().selectWorkspace(workspace.id)
    return workspace
  },

  loadDocuments: async () => {
    const workspaceId = get().activeWorkspaceId
    if (!workspaceId) return
    set({ loadingDocuments: true, error: null })
    try {
      const res = await api.get<DocumentSummary[]>(`/api/documents/workspace/${workspaceId}`)
      // Ignorer une réponse arrivée après un changement de workspace
      if (get().activeWorkspaceId === workspaceId) set({ documents: res.data })
    } catch {
      set({ error: 'Impossible de charger les documents' })
    } finally {
      set({ loadingDocuments: false })
    }
  },

  createDocument: async (title) => {
    const workspaceId = get().activeWorkspaceId
    if (!workspaceId) throw new Error('Aucun workspace actif')
    const res = await api.post<DocumentSummary>('/api/documents', { title: title || 'Sans titre', workspaceId })
    get().addDocument(res.data)
    return res.data
  },

  addDocument: (doc) => {
    if (doc.workspaceId !== get().activeWorkspaceId) return
    set(state => ({ documents: [doc, ...state.documents.filter(d => d.id !== doc.id)] }))
  },

  updateDocumentLocally: (id, patch) => {
    set(state => ({ documents: state.documents.map(d => (d.id === id ? { ...d, ...patch } : d)) }))
  },

  deleteDocument: async (id) => {
    await api.delete(`/api/documents/${id}`)
    set(state => ({ documents: state.documents.filter(d => d.id !== id) }))
  },

  reset: () => set({ workspaces: [], activeWorkspaceId: null, documents: [], error: null })
}))

export function useActiveWorkspace(): Workspace | null {
  return useWorkspaceStore(s => s.workspaces.find(w => w.id === s.activeWorkspaceId) ?? null)
}
