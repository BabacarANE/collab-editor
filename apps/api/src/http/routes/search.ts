import type { FastifyPluginAsync } from 'fastify'
import type { SearchService } from '../../services/SearchService'
import { authenticate, currentUserId } from '../auth'

export const searchRoutes: FastifyPluginAsync<{ search: SearchService }> = async (app, { search }) => {
  app.addHook('preHandler', authenticate)

  // GET /api/search?q=<query>&workspaceId=<id>
  app.get('/', async request => {
    const { q, workspaceId } = request.query as { q?: unknown; workspaceId?: unknown }
    return search.searchDocuments(currentUserId(request), q, workspaceId)
  })
}
