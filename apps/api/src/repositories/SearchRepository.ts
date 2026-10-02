import { Prisma, type PrismaClient } from '@prisma/client'

export interface SearchHit {
  id: string
  title: string
  workspaceId: string
  updatedAt: Date
  rank: number
  excerpt: string
}

export class SearchRepository {
  constructor(private readonly db: PrismaClient) {}

  // tsQuery doit déjà être assaini (voir SearchService)
  searchVisible(userId: string, tsQuery: string, workspaceId?: string): Promise<SearchHit[]> {
    const workspaceFilter = workspaceId ? Prisma.sql`AND d."workspaceId" = ${workspaceId}` : Prisma.empty
    return this.db.$queryRaw<SearchHit[]>`
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
          OR EXISTS (SELECT 1 FROM "Permission" p WHERE p."documentId" = d.id AND p."userId" = ${userId})
        )
      ORDER BY rank DESC
      LIMIT 20
    `
  }
}
