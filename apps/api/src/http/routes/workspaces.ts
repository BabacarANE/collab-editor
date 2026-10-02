import type { FastifyPluginAsync } from 'fastify'
import type { WorkspaceService } from '../../services/WorkspaceService'
import { authenticate, currentUserId } from '../auth'

export const workspaceRoutes: FastifyPluginAsync<{ workspaces: WorkspaceService }> = async (app, { workspaces }) => {
  app.addHook('preHandler', authenticate)

  app.get('/', async request => workspaces.listForUser(currentUserId(request)))

  app.post('/', async (request, reply) => {
    const { name } = (request.body ?? {}) as { name?: unknown }
    return reply.status(201).send(await workspaces.create(currentUserId(request), name))
  })

  app.get('/:id', async request => {
    const { id } = request.params as { id: string }
    return workspaces.get(currentUserId(request), id)
  })

  app.post('/:id/members', async (request, reply) => {
    const { id } = request.params as { id: string }
    const { email, role } = (request.body ?? {}) as { email?: unknown; role?: unknown }
    return reply.status(201).send(await workspaces.invite(currentUserId(request), id, email, role))
  })

  app.delete('/:id/members/:memberId', async (request, reply) => {
    const { id, memberId } = request.params as { id: string; memberId: string }
    await workspaces.removeMember(currentUserId(request), id, memberId)
    return reply.status(204).send()
  })
}
