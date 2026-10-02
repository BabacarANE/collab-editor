import { FastifyInstance } from 'fastify'
import prisma from '../lib/prisma'
import { authenticate } from '../lib/auth'
import { contentDisposition, escapeHtml, sanitizeDocumentHtml } from '../lib/html'
import { canAccessDocument, getDocumentRole, isWorkspaceMember, roleAllows } from '../lib/access'

const MAX_TITLE_LENGTH = 255
const MAX_COMMENT_LENGTH = 5000


export async function documentRoutes(app: FastifyInstance) {

  // POST /api/documents
  app.post('/', { preHandler: authenticate }, async (request, reply) => {
    const { userId } = request.user as { userId: string }
    const { title, workspaceId } = request.body as { title?: string; workspaceId: string }

    if (!workspaceId) {
      return reply.status(400).send({ error: 'workspaceId requis' })
    }
    if (title !== undefined && (typeof title !== 'string' || title.length > MAX_TITLE_LENGTH)) {
      return reply.status(400).send({ error: 'Titre invalide' })
    }

    // Seuls les membres du workspace peuvent y créer des documents
    if (!(await isWorkspaceMember(userId, workspaceId))) {
      return reply.status(403).send({ error: 'Accès refusé au workspace' })
    }

    const document = await prisma.document.create({
      data: {
        title: title?.trim() || 'Sans titre',
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
        content: true,
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

    if (typeof title !== 'string' || title.length > MAX_TITLE_LENGTH) {
      return reply.status(400).send({ error: 'Titre invalide' })
    }

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
      data: { title: title.trim() || 'Sans titre' },
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

    if (typeof content !== 'string') {
      return reply.status(400).send({ error: 'content requis' })
    }

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
      // Le HTML est nettoyé côté serveur : il est ré-affiché et exporté
      data: { content: sanitizeDocumentHtml(content) }
    })

    return reply.status(204).send()
  })

// POST /api/documents/:id/snapshots — Créer un snapshot nommé
  app.post('/:id/snapshots', { preHandler: authenticate }, async (request, reply) => {
    const { userId } = request.user as { userId: string }
    const { id } = request.params as { id: string }
    const { name } = request.body as { name?: string }

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

    if (!document.content) {
      return reply.status(400).send({ error: 'Document vide — impossible de créer un snapshot' })
    }

    const snapshot = await prisma.snapshot.create({
      data: {
        documentId: id,
        name: name?.trim() || `Version du ${new Date().toLocaleDateString('fr-FR')}`,
        content: sanitizeDocumentHtml(document.content),
        createdBy: userId
      },
      select: {
        id: true,
        name: true,
        createdAt: true,
        author: { select: { email: true } }
      }
    })

    return reply.status(201).send(snapshot)
  })

  // GET /api/documents/:id/snapshots — Lister les snapshots
  app.get('/:id/snapshots', { preHandler: authenticate }, async (request, reply) => {
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
      }
    })

    if (!document) {
      return reply.status(404).send({ error: 'Document non trouvé ou accès refusé' })
    }

    const snapshots = await prisma.snapshot.findMany({
      where: { documentId: id },
      select: {
        id: true,
        name: true,
        createdAt: true,
        author: { select: { email: true } }
      },
      orderBy: { createdAt: 'desc' }
    })

    return reply.send(snapshots)
  })

  // GET /api/documents/:id/snapshots/:snapshotId — Voir le contenu d'un snapshot
  app.get('/:id/snapshots/:snapshotId', { preHandler: authenticate }, async (request, reply) => {
    const { userId } = request.user as { userId: string }
    const { id, snapshotId } = request.params as { id: string; snapshotId: string }

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
      return reply.status(404).send({ error: 'Document non trouvé ou accès refusé' })
    }

    const snapshot = await prisma.snapshot.findFirst({
      where: { id: snapshotId, documentId: id },
      select: {
        id: true,
        name: true,
        content: true,
        createdAt: true,
        author: { select: { email: true } }
      }
    })

    if (!snapshot) {
      return reply.status(404).send({ error: 'Snapshot non trouvé' })
    }

    return reply.send(snapshot)
  })

  // POST /api/documents/:id/comments — Créer un commentaire
  app.post('/:id/comments', { preHandler: authenticate }, async (request, reply) => {
    const { userId } = request.user as { userId: string }
    const { id } = request.params as { id: string }
    const { content, parentId } = request.body as { content: string; parentId?: string }

    if (typeof content !== 'string' || !content.trim()) {
      return reply.status(400).send({ error: 'Le contenu du commentaire est requis' })
    }
    if (content.length > MAX_COMMENT_LENGTH) {
      return reply.status(400).send({ error: 'Commentaire trop long' })
    }

    const role = await getDocumentRole(userId, id)
    if (!role) {
      return reply.status(404).send({ error: 'Document non trouvé' })
    }
    if (!roleAllows(role, 'comment')) {
      return reply.status(403).send({ error: 'Vous ne pouvez pas commenter ce document' })
    }

    // Une réponse doit cibler un commentaire racine du même document
    if (parentId !== undefined && parentId !== null) {
      const parent = await prisma.comment.findFirst({
        where: { id: parentId, documentId: id, parentId: null }
      })
      if (!parent) {
        return reply.status(400).send({ error: 'Commentaire parent invalide' })
      }
    }

    const comment = await prisma.comment.create({
      data: {
        documentId: id,
        authorId: userId,
        content: content.trim(),
        parentId: parentId ?? null
      },
      select: {
        id: true,
        content: true,
        resolved: true,
        parentId: true,
        createdAt: true,
        author: { select: { id: true, email: true } }
      }
    })

    return reply.status(201).send(comment)
  })

  // GET /api/documents/:id/comments — Lister les commentaires
  app.get('/:id/comments', { preHandler: authenticate }, async (request, reply) => {
    const { userId } = request.user as { userId: string }
    const { id } = request.params as { id: string }

    if (!(await canAccessDocument(userId, id, 'read'))) {
      return reply.status(404).send({ error: 'Document non trouvé' })
    }

    const comments = await prisma.comment.findMany({
      where: { documentId: id, parentId: null },
      select: {
        id: true,
        content: true,
        resolved: true,
        createdAt: true,
        author: { select: { id: true, email: true } },
        replies: {
          select: {
            id: true,
            content: true,
            createdAt: true,
            author: { select: { id: true, email: true } }
          },
          orderBy: { createdAt: 'asc' }
        }
      },
      orderBy: { createdAt: 'desc' }
    })

    return reply.send(comments)
  })

  // PATCH /api/documents/:id/comments/:commentId/resolve — Résoudre un commentaire
  app.patch('/:id/comments/:commentId/resolve', { preHandler: authenticate }, async (request, reply) => {
    const { userId } = request.user as { userId: string }
    const { id, commentId } = request.params as { id: string; commentId: string }

    const role = await getDocumentRole(userId, id)
    const comment = role
      ? await prisma.comment.findFirst({ where: { id: commentId, documentId: id } })
      : null

    // L'auteur ou un éditeur/owner du document peut résoudre
    if (!comment || (comment.authorId !== userId && !roleAllows(role, 'edit'))) {
      return reply.status(404).send({ error: 'Commentaire non trouvé ou accès refusé' })
    }

    await prisma.comment.update({
      where: { id: commentId },
      data: { resolved: true }
    })

    return reply.status(204).send()
  })

  // DELETE /api/documents/:id/comments/:commentId — Supprimer un commentaire
  app.delete('/:id/comments/:commentId', { preHandler: authenticate }, async (request, reply) => {
    const { userId } = request.user as { userId: string }
    const { id, commentId } = request.params as { id: string; commentId: string }

    const role = await getDocumentRole(userId, id)
    const comment = role
      ? await prisma.comment.findFirst({ where: { id: commentId, documentId: id } })
      : null

    // L'auteur ou l'owner du document peut supprimer
    if (!comment || (comment.authorId !== userId && !roleAllows(role, 'manage'))) {
      return reply.status(404).send({ error: 'Commentaire non trouvé ou accès refusé' })
    }

    // Les réponses sont supprimées avec le commentaire racine
    await prisma.$transaction([
      prisma.comment.deleteMany({ where: { parentId: commentId } }),
      prisma.comment.delete({ where: { id: commentId } })
    ])

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

    // Nettoyage systématique : le contenu peut dater d'avant la sanitization
    const content = sanitizeDocumentHtml(document.content)
    const title = escapeHtml(document.title)

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
      reply.header('Content-Disposition', contentDisposition(document.title, 'html'))
      return reply.send(html)
    }

    if (format === 'md') {
      const { NodeHtmlMarkdown } = await import('node-html-markdown')
      const markdown = `# ${document.title}\n\n${NodeHtmlMarkdown.translate(content)}`

      reply.header('Content-Type', 'text/markdown; charset=utf-8')
      reply.header('Content-Disposition', contentDisposition(document.title, 'md'))
      return reply.send(markdown)
    }


    if (format === 'pdf') {
        const puppeteer = await import('puppeteer')
        const browser = await puppeteer.default.launch({
          headless: true,
          args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            '--disable-gpu'
          ]
        })

        try {
          const page = await browser.newPage()

          // Aucun accès réseau ni JavaScript pendant le rendu : empêche toute
          // SSRF (services internes, metadata cloud, file://) via le contenu
          await page.setJavaScriptEnabled(false)
          await page.setRequestInterception(true)
          page.on('request', req => {
            const url = req.url()
            if (url.startsWith('data:') || url === 'about:blank') req.continue()
            else req.abort()
          })

          const html = `<!DOCTYPE html>
  <html lang="fr">
  <head>
    <meta charset="UTF-8">
    <title>${title}</title>
    <style>
      * { box-sizing: border-box; }
      body {
        font-family: 'Segoe UI', Arial, sans-serif;
        font-size: 13px;
        line-height: 1.7;
        color: #1a1a1a;
        max-width: 720px;
        margin: 0 auto;
        padding: 48px 40px;
      }
      h1 { font-size: 26px; font-weight: 700; margin: 0 0 8px; color: #111; }
      h2 { font-size: 20px; font-weight: 600; margin: 28px 0 8px; color: #222; }
      h3 { font-size: 16px; font-weight: 600; margin: 20px 0 6px; color: #333; }
      p  { margin: 0 0 12px; }
      ul, ol { margin: 0 0 12px; padding-left: 24px; }
      li { margin-bottom: 4px; }
      code {
        background: #f1f3f4;
        padding: 2px 5px;
        border-radius: 3px;
        font-family: 'Courier New', monospace;
        font-size: 12px;
      }
      pre {
        background: #f1f3f4;
        padding: 14px 16px;
        border-radius: 6px;
        overflow-x: auto;
        margin: 0 0 14px;
      }
      pre code { background: none; padding: 0; }
      table {
        width: 100%;
        border-collapse: collapse;
        margin: 0 0 14px;
        font-size: 12px;
      }
      th, td {
        border: 1px solid #ddd;
        padding: 7px 10px;
        text-align: left;
      }
      th { background: #f5f5f5; font-weight: 600; }
      blockquote {
        border-left: 3px solid #ddd;
        margin: 0 0 14px;
        padding: 4px 16px;
        color: #555;
      }
      .doc-title {
        border-bottom: 2px solid #e8e8e8;
        padding-bottom: 16px;
        margin-bottom: 28px;
      }
      .doc-meta {
        font-size: 11px;
        color: #888;
        margin-top: 4px;
      }
    </style>
  </head>
  <body>
    <div class="doc-title">
      <h1>${title}</h1>
      <div class="doc-meta">Exporté le ${new Date().toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })}</div>
    </div>
    ${content}
  </body>
  </html>`

          await page.setContent(html, { waitUntil: 'load', timeout: 15000 })

          const pdfBuffer = await page.pdf({
            format: 'A4',
            margin: { top: '20mm', bottom: '20mm', left: '15mm', right: '15mm' },
            printBackground: true
          })

          reply.header('Content-Type', 'application/pdf')
          reply.header('Content-Disposition', contentDisposition(document.title, 'pdf'))
          return reply.send(Buffer.from(pdfBuffer))
        } finally {
          await browser.close()
        }
      }

      return reply.status(400).send({ error: 'Format non supporté. Utiliser ?format=html, ?format=md ou ?format=pdf' })
    })



}