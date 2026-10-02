import type { FastifyPluginAsync } from 'fastify'
import type { AuthService } from '../../services/AuthService'

interface Options {
  auth: AuthService
  rateLimitMax: number
}

export const authRoutes: FastifyPluginAsync<Options> = async (app, { auth, rateLimitMax }) => {
  // Limite anti brute-force sur les routes d'authentification
  const limited = { config: { rateLimit: { max: rateLimitMax, timeWindow: '1 minute' } } }
  type Credentials = { email?: unknown; password?: unknown }

  app.post('/register', limited, async (request, reply) => {
    const { email, password } = (request.body ?? {}) as Credentials
    return reply.status(201).send(await auth.register(email, password))
  })

  app.post('/login', limited, async request => {
    const { email, password } = (request.body ?? {}) as Credentials
    return auth.login(email, password)
  })

  app.post('/refresh', limited, async request => {
    const { refreshToken } = (request.body ?? {}) as { refreshToken?: unknown }
    return auth.refresh(refreshToken)
  })

  app.post('/logout', async request => {
    const { refreshToken } = (request.body ?? {}) as { refreshToken?: unknown }
    await auth.logout(refreshToken)
    return { message: 'Déconnecté' }
  })
}
