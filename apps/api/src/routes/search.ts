import { FastifyInstance } from 'fastify'
import prisma from '../lib/prisma'

async function authenticate(request: any, reply: any) {
  try {
    await request.jwtVerify()
  } catch {
    return reply.status(401).send({ error: 'Non authentifié' })
  }
}

export async function searchRoutes(app: FastifyInstance) {

  // GET /api/search?q=<query>&workspaceId=<id>
  app.get('/', { preHandler: authenticate }, async (request, reply) => {
    const { userId } = request.user as { userId: string }
    const { q, workspaceId } = request.query as { q?: string; workspaceId?: string }

    if (!q || q.trim().length < 2) {
      return reply.status(400).send({ error: 'Requête trop courte (minimum 2 caractères)' })
    }

    const query = q.trim()

    let results
    if (workspaceId) {
      results = await prisma.$queryRaw<{
        id: string
        title: string
        workspaceId: string
        updatedAt: Date
        rank: number
        excerpt: string
      }[]>`
        SELECT
          d.id,
          d.title,
          d."workspaceId",
          d."updatedAt",
          ts_rank(d."searchVector", plainto_tsquery('french', ${query})) AS rank,
          ts_headline(
            'french',
            regexp_replace(coalesce(d.content, ''), '<[^>]+>', ' ', 'g'),
            plainto_tsquery('french', ${query}),
            'MaxWords=20, MinWords=10, StartSel=<mark>, StopSel=</mark>, MaxFragments=2'
          ) AS excerpt
        FROM "Document" d
        WHERE
          d."deletedAt" IS NULL
          AND d."workspaceId" = ${workspaceId}
          AND d."searchVector" @@ plainto_tsquery('french', ${query})
          AND (
            d."ownerId" = ${userId}
            OR EXISTS (
              SELECT 1 FROM "Permission" p
              WHERE p."documentId" = d.id AND p."userId" = ${userId}
            )
          )
        ORDER BY rank DESC
        LIMIT 20
      `
    } else {
      results = await prisma.$queryRaw<{
        id: string
        title: string
        workspaceId: string
        updatedAt: Date
        rank: number
        excerpt: string
      }[]>`
        SELECT
          d.id,
          d.title,
          d."workspaceId",
          d."updatedAt",
          ts_rank(d."searchVector", plainto_tsquery('french', ${query})) AS rank,
          ts_headline(
            'french',
            regexp_replace(coalesce(d.content, ''), '<[^>]+>', ' ', 'g'),
            plainto_tsquery('french', ${query}),
            'MaxWords=20, MinWords=10, StartSel=<mark>, StopSel=</mark>, MaxFragments=2'
          ) AS excerpt
        FROM "Document" d
        WHERE
          d."deletedAt" IS NULL
          AND d."searchVector" @@ plainto_tsquery('french', ${query})
          AND (
            d."ownerId" = ${userId}
            OR EXISTS (
              SELECT 1 FROM "Permission" p
              WHERE p."documentId" = d.id AND p."userId" = ${userId}
            )
          )
        ORDER BY rank DESC
        LIMIT 20
      `
    }

    return reply.send(results)
  })
}
