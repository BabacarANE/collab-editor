import Fastify from 'fastify'
import cors from '@fastify/cors'
import helmet from '@fastify/helmet'
import jwt from '@fastify/jwt'
import { authRoutes } from './routes/auth'
import { documentRoutes } from './routes/documents'
import { workspaceRoutes } from './routes/workspaces'  // ← ajouter

const app = Fastify({ logger: true })

app.register(cors, { origin: ['http://localhost:5173', 'http://localhost:5174'] })
app.register(helmet)
app.register(jwt, { secret: process.env.JWT_SECRET ?? 'dev_secret' })

app.get('/health', async () => ({ status: 'ok' }))
app.register(authRoutes, { prefix: '/api/auth' })
app.register(documentRoutes, { prefix: '/api/documents' })
app.register(workspaceRoutes, { prefix: '/api/workspaces' })  // ← ajouter

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