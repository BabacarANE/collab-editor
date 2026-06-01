import Fastify from 'fastify'
import cors from '@fastify/cors'
import helmet from '@fastify/helmet'
import jwt from '@fastify/jwt'
import multipart from '@fastify/multipart'
import { authRoutes } from './routes/auth'
import { documentRoutes } from './routes/documents'
import { workspaceRoutes } from './routes/workspaces'
import { importRoutes } from './routes/import'
import { searchRoutes } from './routes/search'
import { notificationRoutes } from './routes/notifications'

const app = Fastify({ logger: true })

app.register(cors, {
  origin: ['http://localhost:5173', 'http://localhost:5174'],
  methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE', 'OPTIONS']
})
app.register(helmet)
app.register(jwt, { secret: process.env.JWT_SECRET ?? 'dev_secret' })

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

const start = async () => {
  try {
    const port = Number(process.env.PORT) || 3000
    await app.listen({ port, host: '0.0.0.0' })
  } catch (err) {
    app.log.error(err)
    process.exit(1)
  }
}

start()