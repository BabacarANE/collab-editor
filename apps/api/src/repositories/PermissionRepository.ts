import type { PrismaClient } from '@prisma/client'
import type { GrantableRole } from '../domain/roles'

const permissionSelect = {
  role: true, grantedAt: true, user: { select: { id: true, email: true } }
} as const

export class PermissionRepository {
  constructor(private readonly db: PrismaClient) {}

  listForDocument(documentId: string) {
    return this.db.permission.findMany({ where: { documentId }, select: permissionSelect })
  }

  upsert(documentId: string, userId: string, role: GrantableRole) {
    return this.db.permission.upsert({
      where: { documentId_userId: { documentId, userId } },
      update: { role },
      create: { documentId, userId, role },
      select: permissionSelect
    })
  }

  // Vrai si une permission existait
  async updateRole(documentId: string, userId: string, role: GrantableRole): Promise<boolean> {
    const { count } = await this.db.permission.updateMany({ where: { documentId, userId }, data: { role } })
    return count > 0
  }

  async remove(documentId: string, userId: string): Promise<void> {
    await this.db.permission.deleteMany({ where: { documentId, userId } })
  }
}
