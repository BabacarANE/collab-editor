import { describe, test } from 'node:test'
import assert from 'node:assert/strict'
import { AppError, ForbiddenError, NotFoundError, UnauthorizedError, ValidationError } from '../../src/domain/errors'
import type { DocumentRepository } from '../../src/repositories/DocumentRepository'
import type { RefreshTokenRepository } from '../../src/repositories/RefreshTokenRepository'
import type { UserRepository } from '../../src/repositories/UserRepository'
import type { WorkspaceRepository } from '../../src/repositories/WorkspaceRepository'
import { AccessService } from '../../src/services/AccessService'
import { AuthService } from '../../src/services/AuthService'
import { ExportService } from '../../src/services/export/ExportService'
import { HtmlExporter, PdfExporter } from '../../src/services/export/exporters'
import { ImportService } from '../../src/services/import/ImportService'
import { MarkdownConverter, TextConverter } from '../../src/services/import/converters'
import type { PasswordHasher, PdfRenderer, TokenService } from '../../src/services/ports'
import { fake } from './fakes'

const OWNER = 'owner-id'
const MEMBER = 'member-id'
const STRANGER = 'stranger-id'

// Document doc-1 : owner + member en VIEWER ; workspace ws-1 : owner et member
function accessFixture() {
  const documents = fake<DocumentRepository>({
    findAccess: async (id, userId) => id !== 'doc-1' ? null : {
      ownerId: OWNER,
      role: userId === MEMBER ? 'VIEWER' : null
    }
  })
  const workspaces = fake<WorkspaceRepository>({
    findMembership: async (_ws, userId) => (userId === STRANGER ? null : ({ role: 'MEMBER' } as never))
  })
  return new AccessService(documents, workspaces)
}

describe('AccessService', () => {
  test('rôle effectif', async () => {
    const access = accessFixture()
    assert.equal(await access.getRole(OWNER, 'doc-1'), 'OWNER')
    assert.equal(await access.getRole(MEMBER, 'doc-1'), 'VIEWER')
    assert.equal(await access.getRole(STRANGER, 'doc-1'), null)
    assert.equal(await access.getRole(OWNER, 'absent'), null)
  })

  test('refus masqué par défaut, personnalisable', async () => {
    const access = accessFixture()
    await assert.rejects(access.require(MEMBER, 'doc-1', 'edit'), NotFoundError)
    await assert.rejects(access.require(MEMBER, 'doc-1', 'edit', () => new ForbiddenError()), ForbiddenError)
    assert.equal(await access.require(MEMBER, 'doc-1', 'read'), 'VIEWER')
  })
})

describe('ImportService', () => {
  const created: unknown[] = []
  const documents = fake<DocumentRepository>({
    create: async data => { created.push(data); return { id: 'new', ...data } as never }
  })
  const service = new ImportService(documents, accessFixture(), [new MarkdownConverter(), new TextConverter()])

  test('choisit le convertisseur selon l\'extension et nettoie le HTML', async () => {
    await service.import(OWNER, { filename: 'notes.md', workspaceId: 'ws-1', buffer: Buffer.from('# Titre\n\n<script>x</script>texte') })
    const doc = created.pop() as { title: string; content: string }
    assert.equal(doc.title, 'Titre')
    assert.ok(!doc.content.includes('<script>'))
  })

  test('texte brut échappé', async () => {
    await service.import(OWNER, { filename: 'a.txt', workspaceId: 'ws-1', buffer: Buffer.from('<b>gras</b>') })
    assert.equal((created.pop() as { content: string }).content, '<p>&lt;b&gt;gras&lt;/b&gt;</p>')
  })

  test('format inconnu, workspace étranger, fichier manquant', async () => {
    await assert.rejects(service.import(OWNER, { filename: 'a.exe', workspaceId: 'ws-1', buffer: Buffer.from('') }), ValidationError)
    await assert.rejects(service.import(STRANGER, { filename: 'a.txt', workspaceId: 'ws-1', buffer: Buffer.from('x') }), ForbiddenError)
    await assert.rejects(service.import(OWNER, { filename: 'a.txt', workspaceId: 'ws-1', buffer: null }), ValidationError)
  })

  test('extensions exposées par les convertisseurs', () => {
    assert.deepEqual(service.supportedExtensions, ['md', 'markdown', 'txt'])
  })
})

describe('ExportService', () => {
  let rendered = ''
  const renderer: PdfRenderer = { render: async html => { rendered = html; return Buffer.from('%PDF-fake') } }
  const documents = fake<DocumentRepository>({
    findActive: async () => ({ title: '<img src=x onerror=alert(1)>', content: '<p>ok</p><script>bad()</script>' } as never)
  })
  const service = new ExportService(documents, accessFixture(), [new HtmlExporter(), new PdfExporter(renderer)])

  test('PDF : titre échappé et contenu nettoyé avant le rendu', async () => {
    const file = await service.export(MEMBER, 'doc-1', 'pdf')
    assert.equal(file.contentType, 'application/pdf')
    assert.ok(!rendered.includes('<img'))
    assert.ok(!rendered.includes('<script>'))
    assert.ok(rendered.includes('<p>ok</p>'))
  })

  test('format non supporté et accès refusé', async () => {
    await assert.rejects(service.export(MEMBER, 'doc-1', 'docx'), ValidationError)
    await assert.rejects(service.export(STRANGER, 'doc-1', 'html'), NotFoundError)
  })
})

describe('AuthService', () => {
  const store = new Set<string>()
  let issued = 0
  const tokens: TokenService = {
    signAccess: id => `access:${id}`,
    signRefresh: id => `refresh:${id}:${++issued}`,
    verify: token => {
      const [type, userId] = token.split(':')
      if (!userId) throw new Error('invalid')
      return { type, userId }
    }
  }
  const refreshTokens = fake<RefreshTokenRepository>({
    create: async (_u, token) => { store.add(token) },
    consume: async token => store.delete(token)
  })
  const hasher: PasswordHasher = { hash: async p => `h(${p})`, compare: async (p, h) => h === `h(${p})` }
  const users = fake<UserRepository>({
    findByEmailInsensitive: async email => email === 'a@b.fr' ? ({ id: 'u1', email, passwordHash: 'h(motdepasse)' } as never) : null
  })
  const auth = new AuthService(users, refreshTokens, tokens, hasher, 1000)

  test('login puis rotation du refresh token (usage unique)', async () => {
    const { refreshToken } = await auth.login('a@b.fr', 'motdepasse')
    const next = await auth.refresh(refreshToken)
    assert.notEqual(next.refreshToken, refreshToken)
    await assert.rejects(auth.refresh(refreshToken), UnauthorizedError)
  })

  test('un access token est refusé comme refresh token', async () => {
    await assert.rejects(auth.refresh('access:u1'), UnauthorizedError)
  })

  test('identifiants invalides', async () => {
    await assert.rejects(auth.login('a@b.fr', 'mauvais'), (e: AppError) => e.statusCode === 401)
    await assert.rejects(auth.login('x@y.fr', 'motdepasse'), UnauthorizedError)
  })
})
