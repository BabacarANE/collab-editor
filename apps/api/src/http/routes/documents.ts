import type { FastifyPluginAsync } from 'fastify'
import type { CommentService } from '../../services/CommentService'
import type { DocumentService } from '../../services/DocumentService'
import type { ExportService } from '../../services/export/ExportService'
import type { SnapshotService } from '../../services/SnapshotService'
import { authenticate, currentUserId } from '../auth'
import { contentDisposition } from '../contentDisposition'

interface Options {
  documents: DocumentService
  comments: CommentService
  snapshots: SnapshotService
  exports: ExportService
}

type Params = { id: string }

export const documentRoutes: FastifyPluginAsync<Options> = async (app, { documents, comments, snapshots, exports }) => {
  app.addHook('preHandler', authenticate)

  // ─── Documents ───────────────────────────────────────────────────────────
  app.post('/', async (request, reply) => {
    const body = (request.body ?? {}) as { title?: unknown; workspaceId?: unknown }
    return reply.status(201).send(await documents.create(currentUserId(request), body))
  })

  app.get('/workspace/:workspaceId', async request => {
    const { workspaceId } = request.params as { workspaceId: string }
    return documents.listInWorkspace(currentUserId(request), workspaceId)
  })

  app.get('/:id', async request => documents.get(currentUserId(request), (request.params as Params).id))

  app.get('/:id/my-role', async request => ({
    role: await documents.roleOf(currentUserId(request), (request.params as Params).id)
  }))

  app.patch('/:id', async request => {
    const { title } = (request.body ?? {}) as { title?: unknown }
    return documents.rename(currentUserId(request), (request.params as Params).id, title)
  })

  app.patch('/:id/content', async (request, reply) => {
    const { content } = (request.body ?? {}) as { content?: unknown }
    await documents.saveContent(currentUserId(request), (request.params as Params).id, content)
    return reply.status(204).send()
  })

  app.delete('/:id', async (request, reply) => {
    await documents.delete(currentUserId(request), (request.params as Params).id)
    return reply.status(204).send()
  })

  // ─── Export ──────────────────────────────────────────────────────────────
  app.get('/:id/export', async (request, reply) => {
    const { format } = request.query as { format?: string }
    const file = await exports.export(currentUserId(request), (request.params as Params).id, format)
    reply.header('Content-Type', file.contentType)
    reply.header('Content-Disposition', contentDisposition(file.filename, file.extension))
    return reply.send(file.body)
  })

  // ─── Versions ────────────────────────────────────────────────────────────
  app.post('/:id/snapshots', async (request, reply) => {
    const { name } = (request.body ?? {}) as { name?: unknown }
    return reply.status(201).send(await snapshots.create(currentUserId(request), (request.params as Params).id, name))
  })

  app.get('/:id/snapshots', async request => snapshots.list(currentUserId(request), (request.params as Params).id))

  app.get('/:id/snapshots/:snapshotId', async request => {
    const { id, snapshotId } = request.params as { id: string; snapshotId: string }
    return snapshots.get(currentUserId(request), id, snapshotId)
  })

  // ─── Commentaires ────────────────────────────────────────────────────────
  app.get('/:id/comments', async request => comments.list(currentUserId(request), (request.params as Params).id))

  app.post('/:id/comments', async (request, reply) => {
    const body = (request.body ?? {}) as { content?: unknown; parentId?: unknown }
    return reply.status(201).send(await comments.create(currentUserId(request), (request.params as Params).id, body))
  })

  app.patch('/:id/comments/:commentId/resolve', async (request, reply) => {
    const { id, commentId } = request.params as { id: string; commentId: string }
    await comments.resolve(currentUserId(request), id, commentId)
    return reply.status(204).send()
  })

  app.delete('/:id/comments/:commentId', async (request, reply) => {
    const { id, commentId } = request.params as { id: string; commentId: string }
    await comments.delete(currentUserId(request), id, commentId)
    return reply.status(204).send()
  })
}
