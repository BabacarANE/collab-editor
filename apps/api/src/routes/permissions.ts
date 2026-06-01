import { FastifyInstance } from 'fastify'
import prisma from '../lib/prisma'

async function authenticate(request: any, reply: any) {
  try {
    await request.jwtVerify()
  } catch {
    return reply.status(401).send({ error: 'Non authentifié' })
  }
}

export async function permissionRoutes(app: FastifyInstance) {


  // GET /api/documents/:id/permissions — lister les permissions
  app.get('/:id/permissions', { preHandler: authenticate }, async (request, reply) => {
    const { userId } = request.user as { userId: string }
    const { id } = request.params as { id: string }

    // Seul l'owner peut gérer les permissions
    const document = await prisma.document.findFirst({
      where: { id, deletedAt: null, ownerId: userId }
    })
    if (!document) {
      return reply.status(403).send({ error: 'Accès refusé — owner uniquement' })
    }

    const permissions = await prisma.permission.findMany({
      where: { documentId: id },
      select: {
        role: true,
        grantedAt: true,
        user: { select: { id: true, email: true } }
      }
    })

    return reply.send(permissions)
  })

  // POST /api/documents/:id/permissions — inviter un utilisateur
  app.post('/:id/permissions', { preHandler: authenticate }, async (request, reply) => {
    const { userId } = request.user as { userId: string }
    const { id } = request.params as { id: string }
    const { email, role } = request.body as { email: string; role: string }

    console.log('body reçu:', { email, role })

    const validRoles = ['EDITOR', 'COMMENTER', 'VIEWER']
    if (!email || !validRoles.includes(role)) {
      return reply.status(400).send({ error: 'email et role (EDITOR/COMMENTER/VIEWER) requis' })
    }

    const document = await prisma.document.findFirst({
      where: { id, deletedAt: null, ownerId: userId }
    })
    if (!document) {
      return reply.status(403).send({ error: 'Accès refusé — owner uniquement' })
    }

    const targetUser = await prisma.user.findUnique({ where: { email } })
    if (!targetUser) {
      return reply.status(404).send({ error: 'Utilisateur non trouvé' })
    }

    if (targetUser.id === userId) {
      return reply.status(400).send({ error: 'Vous êtes déjà owner du document' })
    }

    const permission = await prisma.permission.upsert({
      where: { documentId_userId: { documentId: id, userId: targetUser.id } },
      update: { role: role as any },
      create: { documentId: id, userId: targetUser.id, role: role as any },
      select: {
        role: true,
        grantedAt: true,
        user: { select: { id: true, email: true } }
      }
    })

    return reply.status(201).send(permission)
  })

  // PATCH /api/documents/:id/permissions/:targetUserId — changer le rôle
  app.patch('/:id/permissions/:targetUserId', { preHandler: authenticate }, async (request, reply) => {
    const { userId } = request.user as { userId: string }
    const { id, targetUserId } = request.params as { id: string; targetUserId: string }
    const { role } = request.body as { role: string }

    const validRoles = ['EDITOR', 'COMMENTER', 'VIEWER']
    if (!validRoles.includes(role)) {
      return reply.status(400).send({ error: 'Role invalide (EDITOR/COMMENTER/VIEWER)' })
    }

    const document = await prisma.document.findFirst({
      where: { id, deletedAt: null, ownerId: userId }
    })
    if (!document) {
      return reply.status(403).send({ error: 'Accès refusé — owner uniquement' })
    }

    await prisma.permission.update({
      where: { documentId_userId: { documentId: id, userId: targetUserId } },
      data: { role: role as any }
    })

    return reply.status(204).send()
  })

  // DELETE /api/documents/:id/permissions/:targetUserId — retirer l'accès
  app.delete('/:id/permissions/:targetUserId', { preHandler: authenticate }, async (request, reply) => {
    const { userId } = request.user as { userId: string }
    const { id, targetUserId } = request.params as { id: string; targetUserId: string }

    const document = await prisma.document.findFirst({
      where: { id, deletedAt: null, ownerId: userId }
    })
    if (!document) {
      return reply.status(403).send({ error: 'Accès refusé — owner uniquement' })
    }

    await prisma.permission.deleteMany({
      where: { documentId: id, userId: targetUserId }
    })

    return reply.status(204).send()
  })

    // GET /api/documents/:id/my-role
    app.get('/:id/my-role', { preHandler: authenticate }, async (request, reply) => {
    const { userId } = request.user as { userId: string }
    const { id } = request.params as { id: string }

    const document = await prisma.document.findFirst({
        where: { id, deletedAt: null }
    })
    if (!document) return reply.status(404).send({ error: 'Document non trouvé' })

    if (document.ownerId === userId) return reply.send({ role: 'OWNER' })

    const permission = await prisma.permission.findUnique({
        where: { documentId_userId: { documentId: id, userId } }
    })

    if (!permission) return reply.status(403).send({ error: 'Accès refusé' })

    return reply.send({ role: permission.role })
    })


}