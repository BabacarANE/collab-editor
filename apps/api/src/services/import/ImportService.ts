import { ValidationError } from '../../domain/errors'
import { LIMITS } from '../../domain/validation'
import { sanitizeDocumentHtml } from '../../infrastructure/html'
import type { DocumentRepository } from '../../repositories/DocumentRepository'
import type { AccessService } from '../AccessService'
import type { DocumentConverter } from './DocumentConverter'

export interface ImportedFile {
  filename: string
  buffer: Buffer | null
  workspaceId?: string
}

export class ImportService {
  constructor(
    private readonly documents: DocumentRepository,
    private readonly access: AccessService,
    private readonly converters: readonly DocumentConverter[]
  ) {}

  get supportedExtensions(): string[] {
    return this.converters.flatMap(c => [...c.extensions])
  }

  async import(userId: string, file: ImportedFile) {
    if (!file.buffer) throw new ValidationError('Fichier requis')
    if (!file.workspaceId) throw new ValidationError('workspaceId requis')
    await this.access.requireWorkspaceMember(userId, file.workspaceId)

    const extension = file.filename.split('.').pop()?.toLowerCase() ?? ''
    const converter = this.converters.find(c => c.extensions.includes(extension))
    if (!converter) throw new ValidationError('Format non supporté. Utiliser .md, .docx ou .txt')

    const { title, html } = await converter.convert(file.buffer, file.filename.replace(/\.[^/.]+$/, ''))
    return this.documents.create({
      title: title.slice(0, LIMITS.title) || 'Sans titre',
      content: sanitizeDocumentHtml(html),
      workspaceId: file.workspaceId,
      ownerId: userId
    })
  }
}
