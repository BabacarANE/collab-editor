import { ForbiddenError, NotFoundError, ValidationError } from '../domain/errors'
import { isGrantableRole } from '../domain/roles'
import type { PermissionRepository } from '../repositories/PermissionRepository'
import type { UserRepository } from '../repositories/UserRepository'
import type { AccessService } from './AccessService'

const ownerOnly = () => new ForbiddenError('Accès refusé — owner uniquement')

// Partage d'un document : réservé à son propriétaire
export class PermissionService {
  constructor(
    private readonly permissions: PermissionRepository,
    private readonly users: UserRepository,
    private readonly access: AccessService
  ) {}

  async list(userId: string, documentId: string) {
    await this.access.require(userId, documentId, 'manage', ownerOnly)
    return this.permissions.listForDocument(documentId)
  }

  async grant(userId: string, documentId: string, email: unknown, role: unknown) {
    if (typeof email !== 'string' || !email || !isGrantableRole(role)) {
      throw new ValidationError('email et role (EDITOR/COMMENTER/VIEWER) requis')
    }
    await this.access.require(userId, documentId, 'manage', ownerOnly)

    const target = await this.users.findByEmailInsensitive(email.trim())
    if (!target) throw new NotFoundError('Utilisateur non trouvé')
    if (target.id === userId) throw new ValidationError('Vous êtes déjà owner du document')

    return this.permissions.upsert(documentId, target.id, role)
  }

  async changeRole(userId: string, documentId: string, targetUserId: string, role: unknown): Promise<void> {
    if (!isGrantableRole(role)) throw new ValidationError('Role invalide (EDITOR/COMMENTER/VIEWER)')
    await this.access.require(userId, documentId, 'manage', ownerOnly)
    if (!(await this.permissions.updateRole(documentId, targetUserId, role))) {
      throw new NotFoundError('Permission non trouvée')
    }
  }

  async revoke(userId: string, documentId: string, targetUserId: string): Promise<void> {
    await this.access.require(userId, documentId, 'manage', ownerOnly)
    await this.permissions.remove(documentId, targetUserId)
  }
}
