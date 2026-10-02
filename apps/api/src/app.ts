import Fastify from 'fastify'
import cors from '@fastify/cors'
import helmet from '@fastify/helmet'
import jwt from '@fastify/jwt'
import multipart from '@fastify/multipart'
import rateLimit from '@fastify/rate-limit'
import { config } from './lib/config'
import { authRoutes } from './routes/auth'
import { documentRoutes } from './routes/documents'
import { workspaceRoutes } from './routes/workspaces'
import { importRoutes } from './routes/import'
import { searchRoutes } from './routes/search'
import { notificationRoutes } from './routes/notifications'
import { permissionRoutes } from './routes/permissions'

export function buildApp() {
  const app = Fastify({ logger: process.env.NODE_ENV !== 'test' })

  app.register(cors, {
    origin: config.corsOrigins,
    methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE', 'OPTIONS']
  })
  app.register(helmet)
  app.register(jwt, { secret: config.jwtSecret })

  // Rate limiting — activé route par route (auth notamment)
  app.register(rateLimit, { global: false })

  // Ne jamais exposer le détail des erreurs internes au client
  app.setErrorHandler((error: any, request, reply) => {
    if (error.code === 'P2025') {
      return reply.status(404).send({ error: 'Ressource non trouvée' })
    }
    const status = error.statusCode && error.statusCode < 500 ? error.statusCode : 500
    if (status >= 500) request.log.error(error)
    return reply.status(status).send({
      error: status >= 500 ? 'Erreur interne' : error.message
    })
  })

  // Multipart pour l'upload de fichiers (import)
  // Limite à 10 Mo par fichier
  app.register(multipart, {
    limits: { fileSize: 10 * 1024 * 1024 }
  })

  app.get('/health', async () => ({ status: 'ok' }))
  app.register(authRoutes, { prefix: '/api/auth' })
  app.register(documentRoutes, { prefix: '/api/documents' })
  app.register(workspaceRoutes, { prefix: '/api/workspaces' })
  app.register(importRoutes, { prefix: '/api/import' })
  app.register(searchRoutes, { prefix: '/api/search' })
  app.register(notificationRoutes, { prefix: '/api/notifications' })
  app.register(permissionRoutes, { prefix: '/api/documents' })

  return app
}
