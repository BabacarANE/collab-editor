import type { PrismaClient } from '@prisma/client'

export class UserRepository {
  constructor(private readonly db: PrismaClient) {}

  findById(id: string) {
    return this.db.user.findUnique({ where: { id } })
  }

  findByEmail(email: string) {
    return this.db.user.findUnique({ where: { email } })
  }

  // Comptes créés avant la normalisation des emails : recherche insensible à la casse
  findByEmailInsensitive(email: string) {
    return this.db.user.findFirst({ where: { email: { equals: email, mode: 'insensitive' } } })
  }

  create(email: string, passwordHash: string) {
    return this.db.user.create({
      data: { email, passwordHash },
      select: { id: true, email: true, createdAt: true }
    })
  }
}
