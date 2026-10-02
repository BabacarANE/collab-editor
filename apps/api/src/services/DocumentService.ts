import { ForbiddenError, NotFoundError, ValidationError } from '../domain/errors'
import { normalizeTitle, requireString } from '../domain/validation'
import { sanitizeDocumentHtml } from '../infrastructure/html'
import type { DocumentRepository } from '../repositories/DocumentRepository'
import type { AccessService } from './AccessService'

export class DocumentService {
  constructor(
    private readonly documents: DocumentRepository,
    private readonly access: AccessService
  ) {}

  async create(userId: string, input: { title?: unknown; workspaceId?: unknown }) {
    const workspaceId = requireString(input.workspaceId, 'workspaceId requis')
    const title = normalizeTitle(input.title)
    // Seuls les membres du workspace peuvent y créer des documents
    await this.access.requireWorkspaceMember(userId, workspaceId)
    return this.documents.create({ title, workspaceId, ownerId: userId })
  }

  async get(userId: string, documentId: string) {
    await this.access.require(userId, documentId, 'read', () => new NotFoundError('Document non trouvé'))
    const document = await this.documents.findDetail(documentId)
    if (!document) throw new NotFoundError('Document non trouvé')
    return document
  }

  listInWorkspace(userId: string, workspaceId: string) {
    return this.documents.listVisibleInWorkspace(workspaceId, userId)
  }

  async rename(userId: string, documentId: string, title: unknown) {
    const normalized = normalizeTitle(title, { required: true })
    await this.access.require(userId, documentId, 'edit')
    return this.documents.updateTitle(documentId, normalized)
  }

  // Le HTML est nettoyé côté serveur : il est ré-affiché et exporté
  async saveContent(userId: string, documentId: string, content: unknown): Promise<void> {
    if (typeof content !== 'string') throw new ValidationError('content requis')
    await this.access.require(userId, documentId, 'edit')
    await this.documents.updateContent(documentId, sanitizeDocumentHtml(content))
  }

  async delete(userId: string, documentId: string): Promise<void> {
    await this.access.require(userId, documentId, 'manage')
    await this.documents.softDelete(documentId)
  }

  async roleOf(userId: string, documentId: string) {
    if (!(await this.documents.findActive(documentId))) throw new NotFoundError('Document non trouvé')
    const role = await this.access.getRole(userId, documentId)
    if (!role) throw new ForbiddenError('Accès refusé')
    return role
  }
}
