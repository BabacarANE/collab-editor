import { ValidationError } from '../domain/errors'
import type { SearchRepository } from '../repositories/SearchRepository'

const MAX_QUERY_LENGTH = 200
const MAX_TERMS = 10

// « road ma » -> « road:* & ma:* » : recherche par préfixe, mot par mot.
// Seuls lettres et chiffres sont conservés : aucun opérateur tsquery injectable.
export function toPrefixTsQuery(input: string): string | null {
  const terms = input
    .slice(0, MAX_QUERY_LENGTH)
    .split(/[^\p{L}\p{N}]+/u)
    .filter(Boolean)
    .slice(0, MAX_TERMS)
  return terms.length ? terms.map(t => `${t}:*`).join(' & ') : null
}

export class SearchService {
  constructor(private readonly search: SearchRepository) {}

  async searchDocuments(userId: string, query: unknown, workspaceId?: unknown) {
    if (typeof query !== 'string' || query.trim().length < 2) {
      throw new ValidationError('Requête trop courte (minimum 2 caractères)')
    }
    const tsQuery = toPrefixTsQuery(query)
    if (!tsQuery) return []
    return this.search.searchVisible(userId, tsQuery, typeof workspaceId === 'string' && workspaceId ? workspaceId : undefined)
  }
}
