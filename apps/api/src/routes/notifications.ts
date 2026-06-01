import { FastifyInstance } from 'fastify'
import prisma from '../lib/prisma'

async function authenticate(request: any, reply: any) {
  try {
    await request.jwtVerify()
  } catch {
    return reply.status(401).send({ error: 'Non authentifié' })
  }
}

export async function notificationRoutes(app: FastifyInstance) {

  // GET /api/notifications — lister les notifications de l'utilisateur
  app.get('/', { preHandler: authenticate }, async (request, reply) => {
    const { userId } = request.user as { userId: string }

    const notifications = await prisma.notification.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: 30
    })

    return reply.send(notifications)
  })

  // PATCH /api/notifications/:id/read — marquer comme lue
  app.patch('/:id/read', { preHandler: authenticate }, async (request, reply) => {
    const { userId } = request.user as { userId: string }
    const { id } = request.params as { id: string }

    await prisma.notification.updateMany({
      where: { id, userId },
      data: { read: true }
    })

    return reply.status(204).send()
  })

  // PATCH /api/notifications/read-all — tout marquer comme lu
  app.patch('/read-all', { preHandler: authenticate }, async (request, reply) => {
    const { userId } = request.user as { userId: string }

    await prisma.notification.updateMany({
      where: { userId, read: false },
      data: { read: true }
    })

    return reply.status(204).send()
  })

  // POST /api/notifications/mention — créer une notification de mention
  // Appelé par l'éditeur au moment du save
  app.post('/mention', { preHandler: authenticate }, async (request, reply) => {
    const { userId } = request.user as { userId: string }
    const { mentionedUserId, documentId, documentTitle } = request.body as {
      mentionedUserId: string
      documentId: string
      documentTitle: string
    }

    // Ne pas notifier si on se mentionne soi-même
    if (mentionedUserId === userId) {
      return reply.status(204).send()
    }

    // Vérifier que l'utilisateur mentionné existe
    const mentionedUser = await prisma.user.findUnique({ where: { id: mentionedUserId } })
    if (!mentionedUser) {
      return reply.status(404).send({ error: 'Utilisateur non trouvé' })
    }

    const mentioner = await prisma.user.findUnique({ where: { id: userId } })

    // Éviter les doublons — ne pas recréer si déjà notifié dans les 5 dernières minutes
    const recent = await prisma.notification.findFirst({
      where: {
        userId: mentionedUserId,
        type: 'mention',
        createdAt: { gte: new Date(Date.now() - 5 * 60 * 1000) },
        payload: {
          path: ['documentId'],
          equals: documentId
        }
      }
    })

    if (recent) {
      return reply.status(204).send()
    }

    await prisma.notification.create({
      data: {
        userId: mentionedUserId,
        type: 'mention',
        payload: {
          message: `${mentioner?.email ?? 'Quelqu\'un'} vous a mentionné`,
          documentId,
          documentTitle,
          mentionedBy: mentioner?.email
        }
      }
    })

    return reply.status(201).send()
  })
}
