import { ConflictError, UnauthorizedError, ValidationError } from '../domain/errors'
import { normalizeEmail, validatePassword } from '../domain/validation'
import type { RefreshTokenRepository } from '../repositories/RefreshTokenRepository'
import type { UserRepository } from '../repositories/UserRepository'
import type { PasswordHasher, TokenService } from './ports'

export interface TokenPair {
  accessToken: string
  refreshToken: string
}

export class AuthService {
  constructor(
    private readonly users: UserRepository,
    private readonly refreshTokens: RefreshTokenRepository,
    private readonly tokens: TokenService,
    private readonly hasher: PasswordHasher,
    private readonly refreshTtlMs: number
  ) {}

  async register(email: unknown, password: unknown) {
    if (typeof email !== 'string' || typeof password !== 'string') {
      throw new ValidationError('Email et mot de passe requis')
    }
    const normalizedEmail = normalizeEmail(email)
    validatePassword(password)

    if (await this.users.findByEmail(normalizedEmail)) throw new ConflictError('Email déjà utilisé')

    const user = await this.users.create(normalizedEmail, await this.hasher.hash(password))
    return { user, ...(await this.issueTokens(user.id)) }
  }

  async login(email: unknown, password: unknown) {
    if (typeof email !== 'string' || typeof password !== 'string') {
      throw new ValidationError('Email et mot de passe requis')
    }
    const user = await this.users.findByEmailInsensitive(email.trim())
    // Comparaison effectuée même si l'email est inconnu (temps constant)
    const valid = await this.hasher.compare(password, user?.passwordHash ?? null)
    if (!user || !valid) throw new UnauthorizedError('Identifiants invalides')

    return { user: { id: user.id, email: user.email }, ...(await this.issueTokens(user.id)) }
  }

  // Rotation : un refresh token n'est utilisable qu'une seule fois
  async refresh(refreshToken: unknown): Promise<TokenPair> {
    if (typeof refreshToken !== 'string' || !refreshToken) throw new ValidationError('Refresh token requis')

    let payload: { userId: string; type?: string }
    try {
      payload = this.tokens.verify(refreshToken)
    } catch {
      throw new UnauthorizedError('Token invalide ou expiré')
    }
    // Un access token ne peut pas servir à obtenir de nouveaux tokens
    if (payload.type !== 'refresh') throw new UnauthorizedError('Token invalide ou expiré')

    if (!(await this.refreshTokens.consume(refreshToken, payload.userId))) throw new UnauthorizedError('Token révoqué')
    return this.issueTokens(payload.userId)
  }

  async logout(refreshToken: unknown): Promise<void> {
    if (typeof refreshToken === 'string' && refreshToken) await this.refreshTokens.revoke(refreshToken)
  }

  private async issueTokens(userId: string): Promise<TokenPair> {
    const accessToken = this.tokens.signAccess(userId)
    const refreshToken = this.tokens.signRefresh(userId)
    await this.refreshTokens.create(userId, refreshToken, new Date(Date.now() + this.refreshTtlMs))
    return { accessToken, refreshToken }
  }
}
