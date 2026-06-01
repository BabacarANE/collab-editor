import { FastifyInstance } from 'fastify'
import mammoth from 'mammoth'
import { marked } from 'marked'
import prisma from '../lib/prisma'

async function authenticate(request: any, reply: any) {
  try {
    await request.jwtVerify()
  } catch {
    return reply.status(401).send({ error: 'Non authentifié' })
  }
}

export async function importRoutes(app: FastifyInstance) {

  app.post('/', { preHandler: authenticate }, async (request, reply) => {
    const { userId } = request.user as { userId: string }

    const data = await request.file()
    if (!data) {
      return reply.status(400).send({ error: 'Fichier requis' })
    }

    // Avec @fastify/multipart, les champs texte sont dans data.fields
    // Chaque champ est un objet { value, ... } — pas de structure circulaire si on accède directement
    const fields = data.fields as Record<string, any>
    const workspaceId = fields?.workspaceId?.value as string | undefined

    console.log('filename:', data.filename)
    console.log('workspaceId:', workspaceId)

    if (!workspaceId) {
      return reply.status(400).send({ error: 'workspaceId requis' })
    }

    const filename = data.filename ?? 'import'
    const ext = filename.split('.').pop()?.toLowerCase()
    const buffer = await data.toBuffer()

    let html = ''
    let title = filename.replace(/\.[^/.]+$/, '')

    if (ext === 'md' || ext === 'markdown') {
      const markdownText = buffer.toString('utf-8')
      const firstH1 = markdownText.match(/^#\s+(.+)$/m)
      if (firstH1) title = firstH1[1].trim()
      html = await marked.parse(markdownText)
    } else if (ext === 'docx') {
      const result = await mammoth.convertToHtml({ buffer })
      html = result.value
      const firstH1 = html.match(/<h1[^>]*>(.*?)<\/h1>/i)
      if (firstH1) title = firstH1[1].replace(/<[^>]+>/g, '').trim()
    } else if (ext === 'txt') {
      const lines = buffer.toString('utf-8').split('\n')
      html = lines
        .map(l => l.trim())
        .filter(l => l.length > 0)
        .map(l => `<p>${l}</p>`)
        .join('\n')
    } else {
      return reply.status(400).send({ error: 'Format non supporté. Utiliser .md, .docx ou .txt' })
    }

    const document = await prisma.document.create({
      data: {
        title,
        content: html,
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
}