import Fastify, { type FastifyError } from 'fastify'
import cors from '@fastify/cors'
import helmet from '@fastify/helmet'
import jwt from '@fastify/jwt'
import multipart from '@fastify/multipart'
import rateLimit from '@fastify/rate-limit'
import type { PrismaClient } from '@prisma/client'
import { config } from './config'
import { createServices, type Services } from './container'
import { AppError } from './domain/errors'
import { BcryptPasswordHasher } from './infrastructure/BcryptPasswordHasher'
import { JwtTokenService } from './infrastructure/JwtTokenService'
import { PuppeteerPdfRenderer } from './infrastructure/PuppeteerPdfRenderer'
import { createPrismaClient } from './infrastructure/prisma'
import type { PasswordHasher, PdfRenderer } from './services/ports'
import { authRoutes } from './http/routes/auth'
import { documentRoutes } from './http/routes/documents'
import { importRoutes } from './http/routes/imports'
import { notificationRoutes } from './http/routes/notifications'
import { permissionRoutes } from './http/routes/permissions'
import { searchRoutes } from './http/routes/search'
import { workspaceRoutes } from './http/routes/workspaces'

// Dépendances remplaçables (tests, autres implémentations)
export interface AppDependencies {
  prisma?: PrismaClient
  hasher?: PasswordHasher
  pdfRenderer?: PdfRenderer
}

declare module 'fastify' {
  interface FastifyInstance {
    services: Services
  }
}

export function buildApp(deps: AppDependencies = {}) {
  const app = Fastify({ logger: process.env.NODE_ENV !== 'test' })
  const prisma = deps.prisma ?? createPrismaClient(config.databaseUrl)

  app.register(cors, { origin: config.corsOrigins, methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE', 'OPTIONS'] })
  app.register(helmet)
  app.register(jwt, { secret: config.jwtSecret })
  // Rate limiting — activé route par route (auth notamment)
  app.register(rateLimit, { global: false })
  app.register(multipart, { limits: { fileSize: config.uploadMaxBytes } })

  // Erreurs métier -> statut HTTP ; jamais de détail interne exposé
  app.setErrorHandler((error: FastifyError | AppError, request, reply) => {
    if (error instanceof AppError) return reply.status(error.statusCode).send({ error: error.message })
    if ((error as { code?: string }).code === 'P2025') return reply.status(404).send({ error: 'Ressource non trouvée' })
    const status = error.statusCode && error.statusCode < 500 ? error.statusCode : 500
    if (status >= 500) request.log.error(error)
    return reply.status(status).send({ error: status >= 500 ? 'Erreur interne' : error.message })
  })

  app.get('/health', async () => ({ status: 'ok' }))

  app.register(async scope => {
    const services = createServices({
      prisma,
      tokens: new JwtTokenService(app.jwt, config.accessTokenTtl, Math.floor(config.refreshTokenTtlMs / 1000)),
      hasher: deps.hasher ?? new BcryptPasswordHasher(),
      pdfRenderer: deps.pdfRenderer ?? new PuppeteerPdfRenderer(),
      refreshTokenTtlMs: config.refreshTokenTtlMs
    })
    app.decorate('services', services)

    scope.register(authRoutes, { prefix: '/api/auth', auth: services.auth, rateLimitMax: config.authRateLimitMax })
    scope.register(workspaceRoutes, { prefix: '/api/workspaces', workspaces: services.workspaces })
    scope.register(documentRoutes, { prefix: '/api/documents', ...services })
    scope.register(permissionRoutes, { prefix: '/api/documents', permissions: services.permissions })
    scope.register(importRoutes, { prefix: '/api/import', imports: services.imports })
    scope.register(searchRoutes, { prefix: '/api/search', search: services.search })
    scope.register(notificationRoutes, { prefix: '/api/notifications', notifications: services.notifications })
  })

  app.addHook('onClose', async () => {
    if (!deps.prisma) await prisma.$disconnect()
  })

  return app
}
