// Tests d'intégration sécurité — nécessitent une base PostgreSQL migrée
// (DATABASE_URL). Lancement : pnpm --filter @collab/api test
import { after, before, describe, test } from 'node:test'
import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { buildApp } from '../src/app'
import prisma from '../src/lib/prisma'

const app = buildApp()

interface TestUser { id: string; email: string; accessToken: string; refreshToken: string }

async function register(): Promise<TestUser> {
  const email = `test-${randomUUID()}@example.com`
  const res = await app.inject({
    method: 'POST', url: '/api/auth/register',
    payload: { email, password: 'motdepasse-solide' }
  })
  assert.equal(res.statusCode, 201, res.body)
  const body = res.json()
  return { id: body.user.id, email, accessToken: body.accessToken, refreshToken: body.refreshToken }
}

function as(user: TestUser) {
  return { authorization: `Bearer ${user.accessToken}` }
}

let owner: TestUser
let viewer: TestUser
let stranger: TestUser
let workspaceId: string
let documentId: string

before(async () => {
  await app.ready()
  owner = await register()
  viewer = await register()
  stranger = await register()

  const ws = await app.inject({ method: 'POST', url: '/api/workspaces', headers: as(owner), payload: { name: 'WS test' } })
  workspaceId = ws.json().id

  const doc = await app.inject({ method: 'POST', url: '/api/documents', headers: as(owner), payload: { title: 'Doc', workspaceId } })
  assert.equal(doc.statusCode, 201)
  documentId = doc.json().id

  const perm = await app.inject({
    method: 'POST', url: `/api/documents/${documentId}/permissions`, headers: as(owner),
    payload: { email: viewer.email, role: 'VIEWER' }
  })
  assert.equal(perm.statusCode, 201)
})

after(async () => {
  await app.close()
  await prisma.$disconnect()
})

describe('authentification', () => {
  test('refuse un mot de passe trop court', async () => {
    const res = await app.inject({
      method: 'POST', url: '/api/auth/register',
      payload: { email: `x-${randomUUID()}@example.com`, password: '123' }
    })
    assert.equal(res.statusCode, 400)
  })

  test('un refresh token ne peut pas servir d\'access token', async () => {
    const res = await app.inject({
      method: 'GET', url: '/api/workspaces',
      headers: { authorization: `Bearer ${owner.refreshToken}` }
    })
    assert.equal(res.statusCode, 401)
  })

  test('un access token ne peut pas servir de refresh token', async () => {
    const res = await app.inject({ method: 'POST', url: '/api/auth/refresh', payload: { refreshToken: owner.accessToken } })
    assert.equal(res.statusCode, 401)
  })

  test('un refresh token ne peut être utilisé qu\'une fois', async () => {
    const user = await register()
    const first = await app.inject({ method: 'POST', url: '/api/auth/refresh', payload: { refreshToken: user.refreshToken } })
    assert.equal(first.statusCode, 200)
    const second = await app.inject({ method: 'POST', url: '/api/auth/refresh', payload: { refreshToken: user.refreshToken } })
    assert.equal(second.statusCode, 401)
  })

  test('login insensible à la casse et identifiants invalides', async () => {
    const ok = await app.inject({ method: 'POST', url: '/api/auth/login', payload: { email: owner.email.toUpperCase(), password: 'motdepasse-solide' } })
    assert.equal(ok.statusCode, 200)
    const ko = await app.inject({ method: 'POST', url: '/api/auth/login', payload: { email: 'inconnu@example.com', password: 'x' } })
    assert.equal(ko.statusCode, 401)
  })
})

describe('contrôle d\'accès', () => {
  test('impossible de créer un document dans le workspace d\'un autre', async () => {
    const res = await app.inject({ method: 'POST', url: '/api/documents', headers: as(stranger), payload: { workspaceId } })
    assert.equal(res.statusCode, 403)
  })

  test('un inconnu ne lit pas les commentaires', async () => {
    const res = await app.inject({ method: 'GET', url: `/api/documents/${documentId}/comments`, headers: as(stranger) })
    assert.equal(res.statusCode, 404)
  })

  test('un inconnu ne peut pas commenter', async () => {
    const res = await app.inject({ method: 'POST', url: `/api/documents/${documentId}/comments`, headers: as(stranger), payload: { content: 'spam' } })
    assert.equal(res.statusCode, 404)
  })

  test('un VIEWER ne peut pas commenter mais peut lire', async () => {
    const post = await app.inject({ method: 'POST', url: `/api/documents/${documentId}/comments`, headers: as(viewer), payload: { content: 'hello' } })
    assert.equal(post.statusCode, 403)
    const get = await app.inject({ method: 'GET', url: `/api/documents/${documentId}/comments`, headers: as(viewer) })
    assert.equal(get.statusCode, 200)
  })

  test('un VIEWER ne peut pas modifier le contenu', async () => {
    const res = await app.inject({ method: 'PATCH', url: `/api/documents/${documentId}/content`, headers: as(viewer), payload: { content: '<p>hack</p>' } })
    assert.equal(res.statusCode, 404)
  })

  test('parentId d\'un autre document refusé', async () => {
    const res = await app.inject({
      method: 'POST', url: `/api/documents/${documentId}/comments`, headers: as(owner),
      payload: { content: 'réponse', parentId: randomUUID() }
    })
    assert.equal(res.statusCode, 400)
  })

  test('suppression d\'un commentaire avec réponses', async () => {
    const root = await app.inject({ method: 'POST', url: `/api/documents/${documentId}/comments`, headers: as(owner), payload: { content: 'racine' } })
    const rootId = root.json().id
    const reply = await app.inject({ method: 'POST', url: `/api/documents/${documentId}/comments`, headers: as(owner), payload: { content: 'réponse', parentId: rootId } })
    assert.equal(reply.statusCode, 201)
    const del = await app.inject({ method: 'DELETE', url: `/api/documents/${documentId}/comments/${rootId}`, headers: as(owner) })
    assert.equal(del.statusCode, 204)
  })

  test('mention : refusée si l\'émetteur n\'a pas accès au document', async () => {
    const res = await app.inject({
      method: 'POST', url: '/api/notifications/mention', headers: as(stranger),
      payload: { mentionedUserId: owner.id, documentId }
    })
    assert.equal(res.statusCode, 403)
  })

  test('PATCH d\'une permission inexistante : 404', async () => {
    const res = await app.inject({
      method: 'PATCH', url: `/api/documents/${documentId}/permissions/${stranger.id}`, headers: as(owner),
      payload: { role: 'EDITOR' }
    })
    assert.equal(res.statusCode, 404)
  })
})

describe('XSS et export', () => {
  test('le contenu est nettoyé à l\'enregistrement', async () => {
    const res = await app.inject({
      method: 'PATCH', url: `/api/documents/${documentId}/content`, headers: as(owner),
      payload: { content: '<p>ok<script>alert(1)</script><img src=x onerror=alert(1)></p>' }
    })
    assert.equal(res.statusCode, 204)
    const doc = await app.inject({ method: 'GET', url: `/api/documents/${documentId}`, headers: as(owner) })
    assert.equal(doc.json().content, '<p>ok</p>')
  })

  test('export HTML : titre échappé et en-tête valide avec caractères spéciaux', async () => {
    await app.inject({
      method: 'PATCH', url: `/api/documents/${documentId}`, headers: as(owner),
      payload: { title: '<script>x</script> "été" 🚀' }
    })
    const res = await app.inject({ method: 'GET', url: `/api/documents/${documentId}/export?format=html`, headers: as(owner) })
    assert.equal(res.statusCode, 200)
    assert.ok(!res.body.includes('<script>x</script>'))
    assert.match(String(res.headers['content-disposition']), /filename\*=UTF-8''/)
  })

  test('import .txt : le HTML est échappé', async () => {
    const boundary = '----test'
    const payload =
      `--${boundary}\r\nContent-Disposition: form-data; name="workspaceId"\r\n\r\n${workspaceId}\r\n` +
      `--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="note.txt"\r\nContent-Type: text/plain\r\n\r\n<img src=x onerror=alert(1)>\r\n` +
      `--${boundary}--\r\n`
    const res = await app.inject({
      method: 'POST', url: '/api/import',
      headers: { ...as(owner), 'content-type': `multipart/form-data; boundary=${boundary}` },
      payload
    })
    assert.equal(res.statusCode, 201, res.body)
    const doc = await prisma.document.findUnique({ where: { id: res.json().id } })
    assert.equal(doc?.content, '<p>&lt;img src=x onerror=alert(1)&gt;</p>')
  })

  test('import dans un workspace étranger refusé', async () => {
    const boundary = '----test'
    const payload =
      `--${boundary}\r\nContent-Disposition: form-data; name="workspaceId"\r\n\r\n${workspaceId}\r\n` +
      `--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="note.txt"\r\nContent-Type: text/plain\r\n\r\nhello\r\n` +
      `--${boundary}--\r\n`
    const res = await app.inject({
      method: 'POST', url: '/api/import',
      headers: { ...as(stranger), 'content-type': `multipart/form-data; boundary=${boundary}` },
      payload
    })
    assert.equal(res.statusCode, 403)
  })
})
