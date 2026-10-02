import prisma from './prisma'

export type DocumentRole = 'OWNER' | 'EDITOR' | 'COMMENTER' | 'VIEWER'

// Rôles autorisés par type d'action, du plus permissif au plus restreint
const CAN_READ: DocumentRole[] = ['OWNER', 'EDITOR', 'COMMENTER', 'VIEWER']
const CAN_COMMENT: DocumentRole[] = ['OWNER', 'EDITOR', 'COMMENTER']
const CAN_EDIT: DocumentRole[] = ['OWNER', 'EDITOR']

export type DocumentAction = 'read' | 'comment' | 'edit' | 'manage'

const ALLOWED: Record<DocumentAction, DocumentRole[]> = {
  read: CAN_READ,
  comment: CAN_COMMENT,
  edit: CAN_EDIT,
  manage: ['OWNER']
}

// Rôle effectif d'un utilisateur sur un document (null = aucun accès)
export async function getDocumentRole(userId: string, documentId: string): Promise<DocumentRole | null> {
  const document = await prisma.document.findFirst({
    where: { id: documentId, deletedAt: null },
    select: {
      ownerId: true,
      permissions: { where: { userId }, select: { role: true } }
    }
  })
  if (!document) return null
  if (document.ownerId === userId) return 'OWNER'
  return (document.permissions[0]?.role as DocumentRole | undefined) ?? null
}

export function roleAllows(role: DocumentRole | null, action: DocumentAction): boolean {
  return role !== null && ALLOWED[action].includes(role)
}

export async function canAccessDocument(userId: string, documentId: string, action: DocumentAction) {
  return roleAllows(await getDocumentRole(userId, documentId), action)
}

export async function isWorkspaceMember(userId: string, workspaceId: string): Promise<boolean> {
  if (typeof workspaceId !== 'string' || !workspaceId) return false
  const membership = await prisma.workspaceMember.findUnique({
    where: { workspaceId_userId: { workspaceId, userId } }
  })
  return membership !== null
}
