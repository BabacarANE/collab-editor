import type { PrismaClient } from '@prisma/client'
import type { WorkspaceRole } from '../domain/roles'

const memberSelect = { role: true, user: { select: { id: true, email: true } } } as const

export class WorkspaceRepository {
  constructor(private readonly db: PrismaClient) {}

  // Création du workspace et de son administrateur dans une même transaction
  createWithAdmin(name: string, adminId: string) {
    return this.db.$transaction(async tx => {
      const workspace = await tx.workspace.create({ data: { name } })
      await tx.workspaceMember.create({ data: { workspaceId: workspace.id, userId: adminId, role: 'ADMIN' } })
      return workspace
    })
  }

  findMembership(workspaceId: string, userId: string) {
    return this.db.workspaceMember.findUnique({ where: { workspaceId_userId: { workspaceId, userId } } })
  }

  findWithMembers(id: string) {
    return this.db.workspace.findUnique({
      where: { id },
      select: { id: true, name: true, createdAt: true, members: { select: memberSelect } }
    })
  }

  listForUser(userId: string) {
    return this.db.workspaceMember.findMany({
      where: { userId },
      select: { role: true, workspace: { select: { id: true, name: true, createdAt: true } } },
      orderBy: { workspace: { createdAt: 'asc' } }
    })
  }

  addMember(workspaceId: string, userId: string, role: WorkspaceRole) {
    return this.db.workspaceMember.create({ data: { workspaceId, userId, role }, select: memberSelect })
  }

  async removeMember(workspaceId: string, userId: string): Promise<void> {
    await this.db.workspaceMember.delete({ where: { workspaceId_userId: { workspaceId, userId } } })
  }
}
