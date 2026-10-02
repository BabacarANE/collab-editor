import type { FastifyPluginAsync } from 'fastify'
import type { NotificationService } from '../../services/NotificationService'
import { authenticate, currentUserId } from '../auth'

export const notificationRoutes: FastifyPluginAsync<{ notifications: NotificationService }> = async (app, { notifications }) => {
  app.addHook('preHandler', authenticate)

  app.get('/', async request => notifications.list(currentUserId(request)))

  app.patch('/read-all', async (request, reply) => {
    await notifications.markAllRead(currentUserId(request))
    return reply.status(204).send()
  })

  app.patch('/:id/read', async (request, reply) => {
    const { id } = request.params as { id: string }
    await notifications.markRead(currentUserId(request), id)
    return reply.status(204).send()
  })

  // Appelé par l'éditeur après une sauvegarde contenant de nouvelles mentions
  app.post('/mention', async (request, reply) => {
    const body = (request.body ?? {}) as { mentionedUserId?: unknown; documentId?: unknown }
    const created = await notifications.notifyMention(currentUserId(request), body)
    return reply.status(created ? 201 : 204).send()
  })
}
