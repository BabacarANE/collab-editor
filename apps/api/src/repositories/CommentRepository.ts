import type { PrismaClient } from '@prisma/client'

const author = { select: { id: true, email: true } } as const

export class CommentRepository {
  constructor(private readonly db: PrismaClient) {}

  create(data: { documentId: string; authorId: string; content: string; parentId: string | null }) {
    return this.db.comment.create({
      data,
      select: { id: true, content: true, resolved: true, parentId: true, createdAt: true, author }
    })
  }

  findInDocument(id: string, documentId: string) {
    return this.db.comment.findFirst({ where: { id, documentId } })
  }

  findRootInDocument(id: string, documentId: string) {
    return this.db.comment.findFirst({ where: { id, documentId, parentId: null } })
  }

  // Commentaires racines et leurs réponses
  listThreads(documentId: string) {
    return this.db.comment.findMany({
      where: { documentId, parentId: null },
      select: {
        id: true, content: true, resolved: true, createdAt: true, author,
        replies: { select: { id: true, content: true, createdAt: true, author }, orderBy: { createdAt: 'asc' } }
      },
      orderBy: { createdAt: 'desc' }
    })
  }

  async resolve(id: string): Promise<void> {
    await this.db.comment.update({ where: { id }, data: { resolved: true } })
  }

  // Les réponses sont supprimées avec le commentaire racine
  async deleteWithReplies(id: string): Promise<void> {
    await this.db.$transaction([
      this.db.comment.deleteMany({ where: { parentId: id } }),
      this.db.comment.delete({ where: { id } })
    ])
  }
}
