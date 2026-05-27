import { FastifyInstance } from 'fastify'
import prisma from '../lib/prisma'

async function authenticate(request: any, reply: any) {
  try {
    await request.jwtVerify()
  } catch {
    return reply.status(401).send({ error: 'Non authentifié' })
  }
}

export async function documentRoutes(app: FastifyInstance) {

  // POST /api/documents
  app.post('/', { preHandler: authenticate }, async (request, reply) => {
    const { userId } = request.user as { userId: string }
    const { title, workspaceId } = request.body as { title?: string; workspaceId: string }

    if (!workspaceId) {
      return reply.status(400).send({ error: 'workspaceId requis' })
    }

    const document = await prisma.document.create({
      data: {
        title: title ?? 'Sans titre',
        workspaceId,
        ownerId: userId
      },
      select: {
        id: true,
        title: true,
        workspaceId: true,
        ownerId: true,
        createdAt: true,
        updatedAt: true
      }
    })

    return reply.status(201).send(document)
  })

  // GET /api/documents/:id
  app.get('/:id', { preHandler: authenticate }, async (request, reply) => {
    const { userId } = request.user as { userId: string }
    const { id } = request.params as { id: string }

    const document = await prisma.document.findFirst({
      where: {
        id,
        deletedAt: null,
        OR: [
          { ownerId: userId },
          { permissions: { some: { userId } } }
        ]
      },
      select: {
        id: true,
        title: true,
        workspaceId: true,
        ownerId: true,
        createdAt: true,
        updatedAt: true
      }
    })

    if (!document) {
      return reply.status(404).send({ error: 'Document non trouvé' })
    }

    return reply.send(document)
  })

  // GET /api/workspaces/:workspaceId/documents
  app.get('/workspace/:workspaceId', { preHandler: authenticate }, async (request, reply) => {
    const { userId } = request.user as { userId: string }
    const { workspaceId } = request.params as { workspaceId: string }

    const documents = await prisma.document.findMany({
      where: {
        workspaceId,
        deletedAt: null,
        OR: [
          { ownerId: userId },
          { permissions: { some: { userId } } }
        ]
      },
      select: {
        id: true,
        title: true,
        workspaceId: true,
        ownerId: true,
        createdAt: true,
        updatedAt: true
      },
      orderBy: { updatedAt: 'desc' }
    })

    return reply.send(documents)
  })

  // PATCH /api/documents/:id
  app.patch('/:id', { preHandler: authenticate }, async (request, reply) => {
    const { userId } = request.user as { userId: string }
    const { id } = request.params as { id: string }
    const { title } = request.body as { title?: string }

    const document = await prisma.document.findFirst({
      where: {
        id,
        deletedAt: null,
        OR: [
          { ownerId: userId },
          { permissions: { some: { userId, role: { in: ['EDITOR', 'OWNER'] } } } }
        ]
      }
    })

    if (!document) {
      return reply.status(404).send({ error: 'Document non trouvé ou accès refusé' })
    }

    const updated = await prisma.document.update({
      where: { id },
      data: { title },
      select: {
        id: true,
        title: true,
        workspaceId: true,
        ownerId: true,
        createdAt: true,
        updatedAt: true
      }
    })

    return reply.send(updated)
  })

  // DELETE /api/documents/:id
  app.delete('/:id', { preHandler: authenticate }, async (request, reply) => {
    const { userId } = request.user as { userId: string }
    const { id } = request.params as { id: string }

    const document = await prisma.document.findFirst({
      where: { id, deletedAt: null, ownerId: userId }
    })

    if (!document) {
      return reply.status(404).send({ error: 'Document non trouvé ou accès refusé' })
    }

    await prisma.document.update({
      where: { id },
      data: { deletedAt: new Date() }
    })

    return reply.status(204).send()
  })
}