import { api } from './client'
import type {
  AppNotification, Comment, DocumentDetail, DocumentPermission, DocumentRole, DocumentSummary,
  SearchResult, Snapshot, User, Workspace, WorkspaceMember, WorkspaceRole
} from '../types'

// Seul module qui connaît les URL de l'API : les composants dépendent de
// ces fonctions typées, pas du transport HTTP
const data = <T>(promise: Promise<{ data: T }>) => promise.then(res => res.data)

export interface AuthResponse {
  user: User
  accessToken: string
  refreshToken: string
}

export type ExportFormat = 'pdf' | 'html' | 'md'

export const authApi = {
  login: (email: string, password: string) => data(api.post<AuthResponse>('/api/auth/login', { email, password })),
  register: (email: string, password: string) => data(api.post<AuthResponse>('/api/auth/register', { email, password })),
}

export const workspacesApi = {
  list: () => data(api.get<Workspace[]>('/api/workspaces')),
  create: (name: string) => data(api.post<Omit<Workspace, 'role'>>('/api/workspaces', { name })),
  members: (workspaceId: string) =>
    data(api.get<{ members: WorkspaceMember[] }>(`/api/workspaces/${workspaceId}`)).then(w => w.members),
  invite: (workspaceId: string, email: string, role: WorkspaceRole) =>
    data(api.post<WorkspaceMember>(`/api/workspaces/${workspaceId}/members`, { email, role })),
  removeMember: (workspaceId: string, userId: string) =>
    data(api.delete<void>(`/api/workspaces/${workspaceId}/members/${userId}`)),
}

export const documentsApi = {
  listInWorkspace: (workspaceId: string) => data(api.get<DocumentSummary[]>(`/api/documents/workspace/${workspaceId}`)),
  create: (workspaceId: string, title: string) => data(api.post<DocumentSummary>('/api/documents', { title, workspaceId })),
  get: (docId: string) => data(api.get<DocumentDetail>(`/api/documents/${docId}`)),
  myRole: (docId: string) => data(api.get<{ role: DocumentRole }>(`/api/documents/${docId}/my-role`)).then(r => r.role),
  rename: (docId: string, title: string) => data(api.patch<DocumentSummary>(`/api/documents/${docId}`, { title })),
  saveContent: (docId: string, content: string) => data(api.patch<void>(`/api/documents/${docId}/content`, { content })),
  remove: (docId: string) => data(api.delete<void>(`/api/documents/${docId}`)),
  export: (docId: string, format: ExportFormat) =>
    data(api.get<Blob>(`/api/documents/${docId}/export`, { params: { format }, responseType: 'blob' })),
  import: (workspaceId: string, file: File) => {
    const form = new FormData()
    form.append('workspaceId', workspaceId)
    form.append('file', file)
    return data(api.post<DocumentSummary>('/api/import', form))
  },
}

export const commentsApi = {
  list: (docId: string) => data(api.get<Comment[]>(`/api/documents/${docId}/comments`)),
  create: (docId: string, content: string, parentId?: string) =>
    data(api.post<Comment>(`/api/documents/${docId}/comments`, { content, parentId })),
  resolve: (docId: string, commentId: string) =>
    data(api.patch<void>(`/api/documents/${docId}/comments/${commentId}/resolve`)),
  remove: (docId: string, commentId: string) =>
    data(api.delete<void>(`/api/documents/${docId}/comments/${commentId}`)),
}

export const snapshotsApi = {
  list: (docId: string) => data(api.get<Snapshot[]>(`/api/documents/${docId}/snapshots`)),
  get: (docId: string, snapshotId: string) => data(api.get<Snapshot>(`/api/documents/${docId}/snapshots/${snapshotId}`)),
  create: (docId: string, name?: string) => data(api.post<Snapshot>(`/api/documents/${docId}/snapshots`, { name })),
}

export const permissionsApi = {
  list: (docId: string) => data(api.get<DocumentPermission[]>(`/api/documents/${docId}/permissions`)),
  grant: (docId: string, email: string, role: DocumentRole) =>
    data(api.post<DocumentPermission>(`/api/documents/${docId}/permissions`, { email, role })),
  changeRole: (docId: string, userId: string, role: DocumentRole) =>
    data(api.patch<void>(`/api/documents/${docId}/permissions/${userId}`, { role })),
  revoke: (docId: string, userId: string) => data(api.delete<void>(`/api/documents/${docId}/permissions/${userId}`)),
}

export const notificationsApi = {
  list: () => data(api.get<AppNotification[]>('/api/notifications')),
  markRead: (id: string) => data(api.patch<void>(`/api/notifications/${id}/read`)),
  markAllRead: () => data(api.patch<void>('/api/notifications/read-all')),
  mention: (documentId: string, mentionedUserId: string) =>
    data(api.post<void>('/api/notifications/mention', { documentId, mentionedUserId })),
}

export const searchApi = {
  documents: (q: string, workspaceId?: string | null) =>
    data(api.get<SearchResult[]>('/api/search', { params: { q, ...(workspaceId ? { workspaceId } : {}) } })),
}
