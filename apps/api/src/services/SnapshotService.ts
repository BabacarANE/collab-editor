import { NotFoundError, ValidationError } from '../domain/errors'
import { sanitizeDocumentHtml } from '../infrastructure/html'
import type { DocumentRepository } from '../repositories/DocumentRepository'
import type { SnapshotRepository } from '../repositories/SnapshotRepository'
import type { AccessService } from './AccessService'

export class SnapshotService {
  constructor(
    private readonly snapshots: SnapshotRepository,
    private readonly documents: DocumentRepository,
    private readonly access: AccessService
  ) {}

  async create(userId: string, documentId: string, name: unknown) {
    await this.access.require(userId, documentId, 'edit')
    const document = await this.documents.findActive(documentId)
    if (!document?.content) throw new ValidationError('Document vide — impossible de créer un snapshot')

    const label = typeof name === 'string' && name.trim()
      ? name.trim().slice(0, 255)
      : `Version du ${new Date().toLocaleDateString('fr-FR')}`

    return this.snapshots.create({
      documentId,
      name: label,
      content: sanitizeDocumentHtml(document.content),
      createdBy: userId
    })
  }

  async list(userId: string, documentId: string) {
    await this.access.require(userId, documentId, 'read')
    return this.snapshots.listForDocument(documentId)
  }

  async get(userId: string, documentId: string, snapshotId: string) {
    await this.access.require(userId, documentId, 'read')
    const snapshot = await this.snapshots.findInDocument(snapshotId, documentId)
    if (!snapshot) throw new NotFoundError('Snapshot non trouvé')
    return snapshot
  }
}
