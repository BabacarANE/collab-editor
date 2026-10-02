import { NotFoundError, ValidationError } from '../../domain/errors'
import { sanitizeDocumentHtml } from '../../infrastructure/html'
import type { DocumentRepository } from '../../repositories/DocumentRepository'
import type { AccessService } from '../AccessService'
import type { DocumentExporter, ExportResult } from './DocumentExporter'

export interface ExportedFile extends ExportResult {
  filename: string
  extension: string
}

export class ExportService {
  constructor(
    private readonly documents: DocumentRepository,
    private readonly access: AccessService,
    private readonly exporters: readonly DocumentExporter[]
  ) {}

  async export(userId: string, documentId: string, format: unknown): Promise<ExportedFile> {
    await this.access.require(userId, documentId, 'read', () => new NotFoundError('Document non trouvé'))
    const exporter = this.exporters.find(e => e.format === format)
    if (!exporter) {
      throw new ValidationError(`Format non supporté. Utiliser ${this.exporters.map(e => `?format=${e.format}`).join(', ')}`)
    }

    const document = await this.documents.findActive(documentId)
    if (!document) throw new NotFoundError('Document non trouvé')

    // Nettoyage systématique : le contenu peut dater d'avant la sanitization
    const result = await exporter.export({ title: document.title, content: sanitizeDocumentHtml(document.content) })
    return { ...result, filename: document.title, extension: exporter.format }
  }
}
