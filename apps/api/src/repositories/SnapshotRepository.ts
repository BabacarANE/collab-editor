import type { PrismaClient } from '@prisma/client'

const base = { id: true, name: true, createdAt: true, author: { select: { email: true } } } as const

export class SnapshotRepository {
  constructor(private readonly db: PrismaClient) {}

  create(data: { documentId: string; name: string; content: string; createdBy: string }) {
    return this.db.snapshot.create({ data, select: base })
  }

  listForDocument(documentId: string) {
    return this.db.snapshot.findMany({ where: { documentId }, select: base, orderBy: { createdAt: 'desc' } })
  }

  findInDocument(id: string, documentId: string) {
    return this.db.snapshot.findFirst({ where: { id, documentId }, select: { ...base, content: true } })
  }
}
