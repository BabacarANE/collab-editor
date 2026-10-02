import { FastifyInstance } from 'fastify'
import prisma from '../lib/prisma'
import { authenticate } from '../lib/auth'
import { canAccessDocument } from '../lib/access'


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
    const { mentionedUserId, documentId } = request.body as {
      mentionedUserId: string
      documentId: string
    }

    if (typeof mentionedUserId !== 'string' || typeof documentId !== 'string') {
      return reply.status(400).send({ error: 'mentionedUserId et documentId requis' })
    }

    // L'auteur de la mention doit pouvoir éditer ou commenter le document
    if (!(await canAccessDocument(userId, documentId, 'comment'))) {
      return reply.status(403).send({ error: 'Accès refusé' })
    }

    // Ne pas notifier si on se mentionne soi-même
    if (mentionedUserId === userId) {
      return reply.status(204).send()
    }

    // L'utilisateur mentionné doit avoir accès au document — sinon on lui
    // révélerait le titre d'un document qu'il ne peut pas voir
    if (!(await canAccessDocument(mentionedUserId, documentId, 'read'))) {
      return reply.status(204).send()
    }

    // Titre lu en base : jamais celui fourni par le client
    const document = await prisma.document.findUnique({
      where: { id: documentId },
      select: { title: true }
    })
    const documentTitle = document?.title ?? 'Document'

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
