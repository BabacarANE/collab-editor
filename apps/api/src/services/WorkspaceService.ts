import { ConflictError, ForbiddenError, NotFoundError, ValidationError } from '../domain/errors'
import { WORKSPACE_ROLES, type WorkspaceRole } from '../domain/roles'
import type { UserRepository } from '../repositories/UserRepository'
import type { WorkspaceRepository } from '../repositories/WorkspaceRepository'

export class WorkspaceService {
  constructor(
    private readonly workspaces: WorkspaceRepository,
    private readonly users: UserRepository
  ) {}

  create(userId: string, name: unknown) {
    if (typeof name !== 'string' || !name.trim()) throw new ValidationError('Le nom du workspace est requis')
    return this.workspaces.createWithAdmin(name.trim(), userId)
  }

  async listForUser(userId: string) {
    const memberships = await this.workspaces.listForUser(userId)
    return memberships.map(m => ({ ...m.workspace, role: m.role }))
  }

  async get(userId: string, workspaceId: string) {
    if (!(await this.workspaces.findMembership(workspaceId, userId))) {
      throw new NotFoundError('Workspace non trouvé ou accès refusé')
    }
    return this.workspaces.findWithMembers(workspaceId)
  }

  async invite(userId: string, workspaceId: string, email: unknown, role: unknown) {
    if (typeof email !== 'string' || !email) throw new ValidationError('email requis')
    const memberRole: WorkspaceRole = WORKSPACE_ROLES.includes(role as WorkspaceRole) ? (role as WorkspaceRole) : 'MEMBER'

    await this.requireAdmin(userId, workspaceId, 'Seul un admin peut inviter des membres')

    const target = await this.users.findByEmailInsensitive(email.trim())
    if (!target) throw new NotFoundError('Utilisateur non trouvé')
    if (await this.workspaces.findMembership(workspaceId, target.id)) throw new ConflictError('Cet utilisateur est déjà membre')

    return this.workspaces.addMember(workspaceId, target.id, memberRole)
  }

  async removeMember(userId: string, workspaceId: string, memberId: string): Promise<void> {
    if (userId === memberId) throw new ValidationError('Vous ne pouvez pas vous retirer vous-même')
    await this.requireAdmin(userId, workspaceId, 'Seul un admin peut retirer des membres')
    if (!(await this.workspaces.findMembership(workspaceId, memberId))) throw new NotFoundError('Membre non trouvé')
    await this.workspaces.removeMember(workspaceId, memberId)
  }

  private async requireAdmin(userId: string, workspaceId: string, message: string): Promise<void> {
    const membership = await this.workspaces.findMembership(workspaceId, userId)
    if (membership?.role !== 'ADMIN') throw new ForbiddenError(message)
  }
}
