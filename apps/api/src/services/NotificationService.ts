import { ValidationError, ForbiddenError } from '../domain/errors'
import type { DocumentRepository } from '../repositories/DocumentRepository'
import type { NotificationRepository } from '../repositories/NotificationRepository'
import type { UserRepository } from '../repositories/UserRepository'
import type { AccessService } from './AccessService'

const MENTION_DEDUP_WINDOW_MS = 5 * 60 * 1000

export class NotificationService {
  constructor(
    private readonly notifications: NotificationRepository,
    private readonly users: UserRepository,
    private readonly documents: DocumentRepository,
    private readonly access: AccessService
  ) {}

  list(userId: string) {
    return this.notifications.listRecent(userId)
  }

  markRead(userId: string, id: string) {
    return this.notifications.markRead(id, userId)
  }

  markAllRead(userId: string) {
    return this.notifications.markAllRead(userId)
  }

  // Vrai si une notification a été créée
  async notifyMention(userId: string, input: { mentionedUserId?: unknown; documentId?: unknown }): Promise<boolean> {
    const { mentionedUserId, documentId } = input
    if (typeof mentionedUserId !== 'string' || typeof documentId !== 'string') {
      throw new ValidationError('mentionedUserId et documentId requis')
    }

    // L'auteur de la mention doit pouvoir éditer ou commenter le document
    await this.access.require(userId, documentId, 'comment', () => new ForbiddenError('Accès refusé'))

    if (mentionedUserId === userId) return false
    // Le destinataire doit avoir accès au document — sinon on lui révélerait son titre
    if (!(await this.access.can(mentionedUserId, documentId, 'read'))) return false

    const since = new Date(Date.now() - MENTION_DEDUP_WINDOW_MS)
    if (await this.notifications.existsRecentMention(mentionedUserId, documentId, since)) return false

    // Titre lu en base : jamais celui fourni par le client
    const [document, mentioner] = await Promise.all([
      this.documents.findActive(documentId),
      this.users.findById(userId)
    ])

    await this.notifications.create(mentionedUserId, 'mention', {
      message: `${mentioner?.email ?? 'Quelqu\'un'} vous a mentionné`,
      documentId,
      documentTitle: document?.title ?? 'Document',
      mentionedBy: mentioner?.email ?? null
    })
    return true
  }
}
