// Politique d'accès aux documents : règles pures, sans accès aux données
export type DocumentRole = 'OWNER' | 'EDITOR' | 'COMMENTER' | 'VIEWER'
export type GrantableRole = Exclude<DocumentRole, 'OWNER'>
export type WorkspaceRole = 'ADMIN' | 'MEMBER'

export type DocumentAction = 'read' | 'comment' | 'edit' | 'manage'

const ALLOWED: Record<DocumentAction, readonly DocumentRole[]> = {
  read: ['OWNER', 'EDITOR', 'COMMENTER', 'VIEWER'],
  comment: ['OWNER', 'EDITOR', 'COMMENTER'],
  edit: ['OWNER', 'EDITOR'],
  manage: ['OWNER']
}

export const GRANTABLE_ROLES: readonly GrantableRole[] = ['EDITOR', 'COMMENTER', 'VIEWER']
export const WORKSPACE_ROLES: readonly WorkspaceRole[] = ['ADMIN', 'MEMBER']

export function roleAllows(role: DocumentRole | null, action: DocumentAction): boolean {
  return role !== null && ALLOWED[action].includes(role)
}

export function isGrantableRole(value: unknown): value is GrantableRole {
  return typeof value === 'string' && (GRANTABLE_ROLES as readonly string[]).includes(value)
}
