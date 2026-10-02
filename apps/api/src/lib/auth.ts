import { FastifyReply, FastifyRequest } from 'fastify'

export interface AccessTokenPayload {
  userId: string
  type?: string
}

// preHandler commun à toutes les routes protégées.
// Refuse les refresh tokens : seul un access token donne accès à l'API.
export async function authenticate(request: FastifyRequest, reply: FastifyReply) {
  try {
    const payload = await request.jwtVerify<AccessTokenPayload>()
    if (!payload?.userId || payload.type === 'refresh') {
      return reply.status(401).send({ error: 'Non authentifié' })
    }
  } catch {
    return reply.status(401).send({ error: 'Non authentifié' })
  }
}

export function currentUserId(request: FastifyRequest): string {
  return (request.user as AccessTokenPayload).userId
}
