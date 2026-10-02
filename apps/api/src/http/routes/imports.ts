import type { FastifyPluginAsync } from 'fastify'
import type { ImportService } from '../../services/import/ImportService'
import { authenticate, currentUserId } from '../auth'

export const importRoutes: FastifyPluginAsync<{ imports: ImportService }> = async (app, { imports }) => {
  app.addHook('preHandler', authenticate)

  app.post('/', async (request, reply) => {
    let buffer: Buffer | null = null
    let filename = 'import'
    let workspaceId: string | undefined

    for await (const part of request.parts()) {
      if (part.type === 'file') {
        filename = part.filename || 'import'
        buffer = await part.toBuffer()
      } else if (part.fieldname === 'workspaceId') {
        workspaceId = String(part.value)
      }
    }

    const document = await imports.import(currentUserId(request), { filename, buffer, workspaceId })
    return reply.status(201).send(document)
  })
}
