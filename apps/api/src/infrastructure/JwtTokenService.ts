import type { JWT } from '@fastify/jwt'
import { randomUUID } from 'crypto'
import type { TokenService } from '../services/ports'

export class JwtTokenService implements TokenService {
  constructor(
    private readonly jwt: JWT,
    private readonly accessTtl: string,
    private readonly refreshTtlSeconds: number
  ) {}

  signAccess(userId: string): string {
    return this.jwt.sign({ userId, type: 'access' }, { expiresIn: this.accessTtl })
  }

  // Le jti garantit l'unicité même pour deux connexions dans la même seconde
  signRefresh(userId: string): string {
    return this.jwt.sign({ userId, type: 'refresh', jti: randomUUID() }, { expiresIn: this.refreshTtlSeconds })
  }

  verify(token: string): { userId: string; type?: string } {
    return this.jwt.verify(token)
  }
}
