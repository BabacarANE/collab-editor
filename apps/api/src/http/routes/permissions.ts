import type { FastifyPluginAsync } from 'fastify'
import type { PermissionService } from '../../services/PermissionService'
import { authenticate, currentUserId } from '../auth'

type Params = { id: string; targetUserId: string }

export const permissionRoutes: FastifyPluginAsync<{ permissions: PermissionService }> = async (app, { permissions }) => {
  app.addHook('preHandler', authenticate)

  app.get('/:id/permissions', async request => {
    const { id } = request.params as Params
    return permissions.list(currentUserId(request), id)
  })

  app.post('/:id/permissions', async (request, reply) => {
    const { id } = request.params as Params
    const { email, role } = (request.body ?? {}) as { email?: unknown; role?: unknown }
    return reply.status(201).send(await permissions.grant(currentUserId(request), id, email, role))
  })

  app.patch('/:id/permissions/:targetUserId', async (request, reply) => {
    const { id, targetUserId } = request.params as Params
    const { role } = (request.body ?? {}) as { role?: unknown }
    await permissions.changeRole(currentUserId(request), id, targetUserId, role)
    return reply.status(204).send()
  })

  app.delete('/:id/permissions/:targetUserId', async (request, reply) => {
    const { id, targetUserId } = request.params as Params
    await permissions.revoke(currentUserId(request), id, targetUserId)
    return reply.status(204).send()
  })
}
