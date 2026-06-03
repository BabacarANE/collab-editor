import { FastifyInstance } from 'fastify'
import prisma from '../lib/prisma'

async function authenticate(request: any, reply: any) {
  try {
    await request.jwtVerify()
  } catch {
    return reply.status(401).send({ error: 'Non authentifié' })
  }
}

export async function workspaceRoutes(app: FastifyInstance) {

  // POST /api/workspaces — Créer un workspace
  app.post('/', { preHandler: authenticate }, async (request, reply) => {
    const { userId } = request.user as { userId: string }
    const { name } = request.body as { name?: string }

    if (!name || name.trim() === '') {
      return reply.status(400).send({ error: 'Le nom du workspace est requis' })
    }

    // On crée le workspace ET on ajoute le créateur comme ADMIN
    // en une seule transaction — soit tout passe, soit rien
    const workspace = await prisma.$transaction(async (tx: any) => {
      const ws = await tx.workspace.create({
        data: { name: name.trim() }
      })

      await tx.workspaceMember.create({
        data: {
          workspaceId: ws.id,
          userId,
          role: 'ADMIN'
        }
      })

      return ws
    })

    return reply.status(201).send(workspace)
  })

  // GET /api/workspaces/:id — Récupérer un workspace et ses membres
  app.get('/:id', { preHandler: authenticate }, async (request, reply) => {
    const { userId } = request.user as { userId: string }
    const { id } = request.params as { id: string }

    // Vérifier que l'utilisateur est bien membre de ce workspace
    const membership = await prisma.workspaceMember.findUnique({
      where: {
        workspaceId_userId: { workspaceId: id, userId }
      }
    })

    if (!membership) {
      return reply.status(404).send({ error: 'Workspace non trouvé ou accès refusé' })
    }

    const workspace = await prisma.workspace.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        createdAt: true,
        members: {
          select: {
            role: true,
            user: {
              select: { id: true, email: true }
            }
          }
        }
      }
    })

    return reply.send(workspace)
  })

  // POST /api/workspaces/:id/members — Inviter un membre
  app.post('/:id/members', { preHandler: authenticate }, async (request, reply) => {
    const { userId } = request.user as { userId: string }
    const { id } = request.params as { id: string }
    const { email, role } = request.body as { email?: string; role?: string }

    if (!email) {
      return reply.status(400).send({ error: 'email requis' })
    }

    const validRoles = ['ADMIN', 'MEMBER']
    const memberRole = role && validRoles.includes(role) ? role : 'MEMBER'

    // Vérifier que l'appelant est ADMIN du workspace
    const callerMembership = await prisma.workspaceMember.findUnique({
      where: {
        workspaceId_userId: { workspaceId: id, userId }
      }
    })

    if (!callerMembership || callerMembership.role !== 'ADMIN') {
      return reply.status(403).send({ error: 'Seul un admin peut inviter des membres' })
    }

    // Trouver l'utilisateur à inviter par son email
    const targetUser = await prisma.user.findUnique({
      where: { email }
    })

    if (!targetUser) {
      return reply.status(404).send({ error: 'Utilisateur non trouvé' })
    }

    // Vérifier qu'il n'est pas déjà membre
    const existing = await prisma.workspaceMember.findUnique({
      where: {
        workspaceId_userId: { workspaceId: id, userId: targetUser.id }
      }
    })

    if (existing) {
      return reply.status(409).send({ error: 'Cet utilisateur est déjà membre' })
    }

    const member = await prisma.workspaceMember.create({
      data: {
        workspaceId: id,
        userId: targetUser.id,
        role: memberRole as 'ADMIN' | 'MEMBER'
      },
      select: {
        role: true,
        user: { select: { id: true, email: true } }
      }
    })

    return reply.status(201).send(member)
  })

  // DELETE /api/workspaces/:id/members/:userId — Retirer un membre
  app.delete('/:id/members/:memberId', { preHandler: authenticate }, async (request, reply) => {
    const { userId } = request.user as { userId: string }
    const { id, memberId } = request.params as { id: string; memberId: string }

    // On ne peut pas se retirer soi-même
    if (userId === memberId) {
      return reply.status(400).send({ error: 'Vous ne pouvez pas vous retirer vous-même' })
    }

    // Vérifier que l'appelant est ADMIN
    const callerMembership = await prisma.workspaceMember.findUnique({
      where: {
        workspaceId_userId: { workspaceId: id, userId }
      }
    })

    if (!callerMembership || callerMembership.role !== 'ADMIN') {
      return reply.status(403).send({ error: 'Seul un admin peut retirer des membres' })
    }

    // Vérifier que le membre à retirer existe
    const targetMembership = await prisma.workspaceMember.findUnique({
      where: {
        workspaceId_userId: { workspaceId: id, userId: memberId }
      }
    })

    if (!targetMembership) {
      return reply.status(404).send({ error: 'Membre non trouvé' })
    }

    await prisma.workspaceMember.delete({
      where: {
        workspaceId_userId: { workspaceId: id, userId: memberId }
      }
    })

    return reply.status(204).send()
  })

    // GET /api/workspaces — Lister les workspaces de l'utilisateur
    app.get('/', { preHandler: authenticate }, async (request, reply) => {
    const { userId } = request.user as { userId: string }

    const memberships = await prisma.workspaceMember.findMany({
        where: { userId },
        select: {
        role: true,
        workspace: {
            select: {
            id: true,
            name: true,
            createdAt: true
            }
        }
        },
        orderBy: { workspace: { createdAt: 'asc' } }
    })

    // On renvoie juste les workspaces, pas les memberships
    const workspaces = memberships.map(m => ({
        ...m.workspace,
        role: m.role
    }))

    return reply.send(workspaces)
    })
}