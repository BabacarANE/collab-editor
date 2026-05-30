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
  // PATCH /api/documents/:id/content — Sauvegarder le contenu
  app.patch('/:id/content', { preHandler: authenticate }, async (request, reply) => {
    const { userId } = request.user as { userId: string }
    const { id } = request.params as { id: string }
    const { content } = request.body as { content: string }

    // Vérifier que l'utilisateur a le droit d'éditer
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

    await prisma.document.update({
      where: { id },
      data: { content }
    })

    return reply.status(204).send()
  })

  // GET /api/documents/:id/export?format=html
  // GET /api/documents/:id/export?format=md
  app.get('/:id/export', { preHandler: authenticate }, async (request, reply) => {
    const { userId } = request.user as { userId: string }
    const { id } = request.params as { id: string }
    const { format } = request.query as { format?: string }

    const document = await prisma.document.findFirst({
      where: {
        id,
        deletedAt: null,
        OR: [
          { ownerId: userId },
          { permissions: { some: { userId } } }
        ]
      }
    })

    if (!document) {
      return reply.status(404).send({ error: 'Document non trouvé' })
    }

    const content = document.content ?? ''
    const title = document.title

    if (format === 'html') {
      const html = `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <title>${title}</title>
  <style>
    body { font-family: sans-serif; max-width: 800px; margin: 40px auto; padding: 0 24px; line-height: 1.6; }
    h1, h2, h3 { margin-top: 1.5em; }
    code { background: #f1f3f4; padding: 2px 6px; border-radius: 4px; }
    pre { background: #f1f3f4; padding: 16px; border-radius: 8px; overflow-x: auto; }
  </style>
</head>
<body>
  <h1>${title}</h1>
  ${content}
</body>
</html>`

      reply.header('Content-Type', 'text/html; charset=utf-8')
      reply.header('Content-Disposition', `attachment; filename="${title}.html"`)
      return reply.send(html)
    }

    if (format === 'md') {
      const { NodeHtmlMarkdown } = await import('node-html-markdown')
      const markdown = `# ${title}\n\n${NodeHtmlMarkdown.translate(content)}`

      reply.header('Content-Type', 'text/markdown; charset=utf-8')
      reply.header('Content-Disposition', `attachment; filename="${title}.md"`)
      return reply.send(markdown)
    }

    return reply.status(400).send({ error: 'Format non supporté. Utiliser ?format=html ou ?format=md' })
  })
}