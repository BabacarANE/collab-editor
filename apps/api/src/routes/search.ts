import { FastifyInstance } from 'fastify'
import { Prisma } from '@prisma/client'
import prisma from '../lib/prisma'
import { authenticate } from '../lib/auth'

const MAX_QUERY_LENGTH = 200

// « road ma » -> « road:* & ma:* » : recherche par préfixe, mot par mot.
// Seuls lettres et chiffres sont conservés : aucun opérateur tsquery injectable.
export function toPrefixTsQuery(input: string): string | null {
  const terms = input
    .slice(0, MAX_QUERY_LENGTH)
    .split(/[^\p{L}\p{N}]+/u)
    .filter(Boolean)
    .slice(0, 10)
  return terms.length ? terms.map(t => `${t}:*`).join(' & ') : null
}

export async function searchRoutes(app: FastifyInstance) {

  // GET /api/search?q=<query>&workspaceId=<id>
  app.get('/', { preHandler: authenticate }, async (request, reply) => {
    const { userId } = request.user as { userId: string }
    const { q, workspaceId } = request.query as { q?: string; workspaceId?: string }

    if (typeof q !== 'string' || q.trim().length < 2) {
      return reply.status(400).send({ error: 'Requête trop courte (minimum 2 caractères)' })
    }

    const tsQuery = toPrefixTsQuery(q)
    if (!tsQuery) return reply.send([])

    const workspaceFilter = typeof workspaceId === 'string' && workspaceId
      ? Prisma.sql`AND d."workspaceId" = ${workspaceId}`
      : Prisma.empty

    const results = await prisma.$queryRaw<{
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
        ts_rank(d."searchVector", to_tsquery('french', ${tsQuery})) AS rank,
        ts_headline(
          'french',
          regexp_replace(coalesce(d.content, ''), '<[^>]+>', ' ', 'g'),
          to_tsquery('french', ${tsQuery}),
          'MaxWords=20, MinWords=10, StartSel=<mark>, StopSel=</mark>, MaxFragments=2'
        ) AS excerpt
      FROM "Document" d
      WHERE
        d."deletedAt" IS NULL
        ${workspaceFilter}
        AND d."searchVector" @@ to_tsquery('french', ${tsQuery})
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

    return reply.send(results)
  })
}
