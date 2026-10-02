import { FastifyInstance } from 'fastify'
import bcrypt from 'bcrypt'
import { randomUUID } from 'crypto'
import prisma from '../lib/prisma'
import { config } from '../lib/config'

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const MIN_PASSWORD_LENGTH = 8
// Hash factice : la comparaison bcrypt s'exécute même si l'email est inconnu (timing constant)
const DUMMY_HASH = bcrypt.hashSync('timing-attack-protection', 12)

// Limite anti brute-force sur les routes d'authentification
const authRateLimit = { rateLimit: { max: 10, timeWindow: '1 minute' } }

export async function authRoutes(app: FastifyInstance) {

  // Émet un couple access/refresh. Le jti garantit l'unicité du refresh token
  // même si deux connexions ont lieu dans la même seconde.
  async function issueTokens(userId: string) {
    const accessToken = app.jwt.sign({ userId, type: 'access' }, { expiresIn: config.accessTokenTtl })
    const refreshToken = app.jwt.sign(
      { userId, type: 'refresh', jti: randomUUID() },
      { expiresIn: Math.floor(config.refreshTokenTtlMs / 1000) }
    )

    await prisma.refreshToken.create({
      data: {
        userId,
        token: refreshToken,
        expiresAt: new Date(Date.now() + config.refreshTokenTtlMs)
      }
    })

    return { accessToken, refreshToken }
  }

  // POST /api/auth/register
  app.post('/register', { config: authRateLimit }, async (request, reply) => {
    const { email, password } = (request.body ?? {}) as { email?: string; password?: string }

    if (typeof email !== 'string' || typeof password !== 'string') {
      return reply.status(400).send({ error: 'Email et mot de passe requis' })
    }
    const normalizedEmail = email.trim().toLowerCase()
    if (!EMAIL_RE.test(normalizedEmail)) {
      return reply.status(400).send({ error: 'Email invalide' })
    }
    if (password.length < MIN_PASSWORD_LENGTH || password.length > 128) {
      return reply.status(400).send({ error: `Le mot de passe doit contenir entre ${MIN_PASSWORD_LENGTH} et 128 caractères` })
    }

    const existing = await prisma.user.findUnique({ where: { email: normalizedEmail } })
    if (existing) {
      return reply.status(409).send({ error: 'Email déjà utilisé' })
    }

    const passwordHash = await bcrypt.hash(password, 12)
    const user = await prisma.user.create({
      data: { email: normalizedEmail, passwordHash },
      select: { id: true, email: true, createdAt: true }
    })

    const tokens = await issueTokens(user.id)
    return reply.status(201).send({ user, ...tokens })
  })

  // POST /api/auth/login
  app.post('/login', { config: authRateLimit }, async (request, reply) => {
    const { email, password } = (request.body ?? {}) as { email?: string; password?: string }

    if (typeof email !== 'string' || typeof password !== 'string') {
      return reply.status(400).send({ error: 'Email et mot de passe requis' })
    }

    const user = await prisma.user.findFirst({
      where: { email: { equals: email.trim(), mode: 'insensitive' } }
    })
    const valid = await bcrypt.compare(password, user?.passwordHash ?? DUMMY_HASH)
    if (!user || !valid) {
      return reply.status(401).send({ error: 'Identifiants invalides' })
    }

    const tokens = await issueTokens(user.id)
    return reply.send({ user: { id: user.id, email: user.email }, ...tokens })
  })

  // POST /api/auth/refresh
  app.post('/refresh', { config: authRateLimit }, async (request, reply) => {
    const { refreshToken } = (request.body ?? {}) as { refreshToken?: string }

    if (typeof refreshToken !== 'string' || !refreshToken) {
      return reply.status(400).send({ error: 'Refresh token requis' })
    }

    let payload: { userId: string; type?: string }
    try {
      payload = app.jwt.verify(refreshToken)
    } catch {
      return reply.status(401).send({ error: 'Token invalide ou expiré' })
    }

    // Un access token ne peut pas servir à obtenir de nouveaux tokens
    if (payload.type !== 'refresh') {
      return reply.status(401).send({ error: 'Token invalide ou expiré' })
    }

    // Rotation : suppression atomique — un token ne peut être utilisé qu'une fois
    const { count } = await prisma.refreshToken.deleteMany({
      where: { token: refreshToken, userId: payload.userId, expiresAt: { gt: new Date() } }
    })
    if (count === 0) {
      return reply.status(401).send({ error: 'Token révoqué' })
    }

    const tokens = await issueTokens(payload.userId)
    return reply.send(tokens)
  })

  // POST /api/auth/logout
  app.post('/logout', async (request, reply) => {
    const { refreshToken } = (request.body ?? {}) as { refreshToken?: string }

    if (typeof refreshToken === 'string' && refreshToken) {
      await prisma.refreshToken.deleteMany({ where: { token: refreshToken } })
    }

    return reply.send({ message: 'Déconnecté' })
  })
}
