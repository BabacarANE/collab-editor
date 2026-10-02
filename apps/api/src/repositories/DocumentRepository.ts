import type { PrismaClient } from '@prisma/client'
import type { DocumentRole } from '../domain/roles'

export const documentSummarySelect = {
  id: true, title: true, workspaceId: true, ownerId: true, createdAt: true, updatedAt: true
} as const

export class DocumentRepository {
  constructor(private readonly db: PrismaClient) {}

  create(data: { title: string; workspaceId: string; ownerId: string; content?: string }) {
    return this.db.document.create({ data, select: documentSummarySelect })
  }

  findActive(id: string) {
    return this.db.document.findFirst({ where: { id, deletedAt: null } })
  }

  findDetail(id: string) {
    return this.db.document.findFirst({
      where: { id, deletedAt: null },
      select: { ...documentSummarySelect, content: true }
    })
  }

  // Documents visibles par un utilisateur : les siens et ceux partagés avec lui
  listVisibleInWorkspace(workspaceId: string, userId: string) {
    return this.db.document.findMany({
      where: {
        workspaceId,
        deletedAt: null,
        OR: [{ ownerId: userId }, { permissions: { some: { userId } } }]
      },
      select: documentSummarySelect,
      orderBy: { updatedAt: 'desc' }
    })
  }

  // Propriétaire et éventuelle permission explicite d'un utilisateur
  async findAccess(id: string, userId: string): Promise<{ ownerId: string; role: DocumentRole | null } | null> {
    const document = await this.db.document.findFirst({
      where: { id, deletedAt: null },
      select: { ownerId: true, permissions: { where: { userId }, select: { role: true } } }
    })
    if (!document) return null
    return { ownerId: document.ownerId, role: (document.permissions[0]?.role as DocumentRole | undefined) ?? null }
  }

  updateTitle(id: string, title: string) {
    return this.db.document.update({ where: { id }, data: { title }, select: documentSummarySelect })
  }

  async updateContent(id: string, content: string): Promise<void> {
    await this.db.document.update({ where: { id }, data: { content } })
  }

  async softDelete(id: string): Promise<void> {
    await this.db.document.update({ where: { id }, data: { deletedAt: new Date() } })
  }
}
