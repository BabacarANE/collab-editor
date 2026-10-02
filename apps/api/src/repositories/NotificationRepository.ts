import type { Prisma, PrismaClient } from '@prisma/client'

export class NotificationRepository {
  constructor(private readonly db: PrismaClient) {}

  listRecent(userId: string, take = 30) {
    return this.db.notification.findMany({ where: { userId }, orderBy: { createdAt: 'desc' }, take })
  }

  async markRead(id: string, userId: string): Promise<void> {
    await this.db.notification.updateMany({ where: { id, userId }, data: { read: true } })
  }

  async markAllRead(userId: string): Promise<void> {
    await this.db.notification.updateMany({ where: { userId, read: false }, data: { read: true } })
  }

  async existsRecentMention(userId: string, documentId: string, since: Date): Promise<boolean> {
    const found = await this.db.notification.findFirst({
      where: { userId, type: 'mention', createdAt: { gte: since }, payload: { path: ['documentId'], equals: documentId } }
    })
    return found !== null
  }

  async create(userId: string, type: string, payload: Prisma.InputJsonValue): Promise<void> {
    await this.db.notification.create({ data: { userId, type, payload } })
  }
}
