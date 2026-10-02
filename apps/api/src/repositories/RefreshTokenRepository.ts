import type { PrismaClient } from '@prisma/client'

export class RefreshTokenRepository {
  constructor(private readonly db: PrismaClient) {}

  async create(userId: string, token: string, expiresAt: Date): Promise<void> {
    await this.db.refreshToken.create({ data: { userId, token, expiresAt } })
  }

  // Suppression atomique : vrai si un token valide a été consommé
  async consume(token: string, userId: string): Promise<boolean> {
    const { count } = await this.db.refreshToken.deleteMany({
      where: { token, userId, expiresAt: { gt: new Date() } }
    })
    return count > 0
  }

  async revoke(token: string): Promise<void> {
    await this.db.refreshToken.deleteMany({ where: { token } })
  }
}
