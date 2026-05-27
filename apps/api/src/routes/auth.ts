import { FastifyInstance } from 'fastify'
import bcrypt from 'bcrypt'
import prisma from '../lib/prisma'

export async function authRoutes(app: FastifyInstance) {

  // POST /api/auth/register
  app.post('/register', async (request, reply) => {
    const { email, password } = request.body as { email: string; password: string }

    if (!email || !password) {
      return reply.status(400).send({ error: 'Email et mot de passe requis' })
    }

    const existing = await prisma.user.findUnique({ where: { email } })
    if (existing) {
      return reply.status(409).send({ error: 'Email déjà utilisé' })
    }

    const passwordHash = await bcrypt.hash(password, 12)
    const user = await prisma.user.create({
      data: { email, passwordHash },
      select: { id: true, email: true, createdAt: true }
    })

    const accessToken = app.jwt.sign({ userId: user.id }, { expiresIn: '15m' })
    const refreshToken = app.jwt.sign({ userId: user.id, type: 'refresh' }, { expiresIn: '7d' })

    await prisma.refreshToken.create({
      data: {
        userId: user.id,
        token: refreshToken,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
      }
    })

    return reply.status(201).send({ user, accessToken, refreshToken })
  })

  // POST /api/auth/login
  app.post('/login', async (request, reply) => {
    const { email, password } = request.body as { email: string; password: string }

    if (!email || !password) {
      return reply.status(400).send({ error: 'Email et mot de passe requis' })
    }

    const user = await prisma.user.findUnique({ where: { email } })
    if (!user) {
      return reply.status(401).send({ error: 'Identifiants invalides' })
    }

    const valid = await bcrypt.compare(password, user.passwordHash)
    if (!valid) {
      return reply.status(401).send({ error: 'Identifiants invalides' })
    }

    const accessToken = app.jwt.sign({ userId: user.id }, { expiresIn: '15m' })
    const refreshToken = app.jwt.sign({ userId: user.id, type: 'refresh' }, { expiresIn: '7d' })

    await prisma.refreshToken.create({
      data: {
        userId: user.id,
        token: refreshToken,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
      }
    })

    return reply.send({
      user: { id: user.id, email: user.email },
      accessToken,
      refreshToken
    })
  })

  // POST /api/auth/refresh
  app.post('/refresh', async (request, reply) => {
    const { refreshToken } = request.body as { refreshToken: string }

    if (!refreshToken) {
      return reply.status(400).send({ error: 'Refresh token requis' })
    }

    let payload: any
    try {
      payload = app.jwt.verify(refreshToken)
    } catch {
      return reply.status(401).send({ error: 'Token invalide ou expiré' })
    }

    const stored = await prisma.refreshToken.findUnique({ where: { token: refreshToken } })
    if (!stored) {
      return reply.status(401).send({ error: 'Token révoqué' })
    }

    // Rotation du refresh token
    await prisma.refreshToken.delete({ where: { token: refreshToken } })

    const newAccessToken = app.jwt.sign({ userId: payload.userId }, { expiresIn: '15m' })
    const newRefreshToken = app.jwt.sign({ userId: payload.userId, type: 'refresh' }, { expiresIn: '7d' })

    await prisma.refreshToken.create({
      data: {
        userId: payload.userId,
        token: newRefreshToken,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
      }
    })

    return reply.send({ accessToken: newAccessToken, refreshToken: newRefreshToken })
  })

  // POST /api/auth/logout
  app.post('/logout', async (request, reply) => {
    const { refreshToken } = request.body as { refreshToken: string }

    if (refreshToken) {
      await prisma.refreshToken.deleteMany({ where: { token: refreshToken } })
    }

    return reply.send({ message: 'Déconnecté' })
  })
}