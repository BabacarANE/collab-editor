export type DocumentRole = 'OWNER' | 'EDITOR' | 'COMMENTER' | 'VIEWER'
export type WorkspaceRole = 'ADMIN' | 'MEMBER'

export interface User {
  id: string
  email: string
}

export interface Workspace {
  id: string
  name: string
  createdAt: string
  role: WorkspaceRole
}

export interface WorkspaceMember {
  role: WorkspaceRole
  user: User
}

export interface DocumentSummary {
  id: string
  title: string
  workspaceId: string
  ownerId: string
  createdAt: string
  updatedAt: string
}

export interface DocumentDetail extends DocumentSummary {
  content: string | null
}

export interface Snapshot {
  id: string
  name: string
  createdAt: string
  author: { email: string }
  content?: string
}

export interface CommentReply {
  id: string
  content: string
  createdAt: string
  author: User
}

export interface Comment {
  id: string
  content: string
  resolved: boolean
  createdAt: string
  author: User
  replies: CommentReply[]
}

export interface DocumentPermission {
  role: DocumentRole
  grantedAt: string
  user: User
}

export interface AppNotification {
  id: string
  type: string
  payload: {
    message: string
    documentId?: string
    documentTitle?: string
    mentionedBy?: string
  }
  read: boolean
  createdAt: string
}

export interface SearchResult {
  id: string
  title: string
  workspaceId: string
  updatedAt: string
  excerpt: string
}
