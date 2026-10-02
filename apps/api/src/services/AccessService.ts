import { ForbiddenError, NotFoundError, type AppError } from '../domain/errors'
import { roleAllows, type DocumentAction, type DocumentRole } from '../domain/roles'
import type { DocumentRepository } from '../repositories/DocumentRepository'
import type { WorkspaceRepository } from '../repositories/WorkspaceRepository'

type Deny = (role: DocumentRole | null) => AppError

// Par défaut un refus ne révèle pas si le document existe
const hideDocument: Deny = () => new NotFoundError('Document non trouvé ou accès refusé')

// Point unique de décision d'accès aux documents et workspaces
export class AccessService {
  constructor(
    private readonly documents: DocumentRepository,
    private readonly workspaces: WorkspaceRepository
  ) {}

  async getRole(userId: string, documentId: string): Promise<DocumentRole | null> {
    const access = await this.documents.findAccess(documentId, userId)
    if (!access) return null
    return access.ownerId === userId ? 'OWNER' : access.role
  }

  async can(userId: string, documentId: string, action: DocumentAction): Promise<boolean> {
    return roleAllows(await this.getRole(userId, documentId), action)
  }

  async require(userId: string, documentId: string, action: DocumentAction, deny: Deny = hideDocument): Promise<DocumentRole> {
    const role = await this.getRole(userId, documentId)
    if (!roleAllows(role, action)) throw deny(role)
    return role as DocumentRole
  }

  async isWorkspaceMember(userId: string, workspaceId: string): Promise<boolean> {
    if (!workspaceId) return false
    return (await this.workspaces.findMembership(workspaceId, userId)) !== null
  }

  async requireWorkspaceMember(userId: string, workspaceId: string): Promise<void> {
    if (!(await this.isWorkspaceMember(userId, workspaceId))) throw new ForbiddenError('Accès refusé au workspace')
  }
}
