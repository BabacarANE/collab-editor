import { ForbiddenError, NotFoundError, ValidationError } from '../domain/errors'
import { roleAllows } from '../domain/roles'
import { LIMITS } from '../domain/validation'
import type { CommentRepository } from '../repositories/CommentRepository'
import type { AccessService } from './AccessService'

const notFound = () => new NotFoundError('Commentaire non trouvé ou accès refusé')

export class CommentService {
  constructor(
    private readonly comments: CommentRepository,
    private readonly access: AccessService
  ) {}

  async list(userId: string, documentId: string) {
    await this.access.require(userId, documentId, 'read', () => new NotFoundError('Document non trouvé'))
    return this.comments.listThreads(documentId)
  }

  async create(userId: string, documentId: string, input: { content?: unknown; parentId?: unknown }) {
    const { content, parentId } = input
    if (typeof content !== 'string' || !content.trim()) throw new ValidationError('Le contenu du commentaire est requis')
    if (content.length > LIMITS.comment) throw new ValidationError('Commentaire trop long')

    await this.access.require(userId, documentId, 'comment', role =>
      role ? new ForbiddenError('Vous ne pouvez pas commenter ce document') : new NotFoundError('Document non trouvé')
    )

    // Une réponse doit cibler un commentaire racine du même document
    if (parentId !== undefined && parentId !== null) {
      if (typeof parentId !== 'string' || !(await this.comments.findRootInDocument(parentId, documentId))) {
        throw new ValidationError('Commentaire parent invalide')
      }
    }

    return this.comments.create({ documentId, authorId: userId, content: content.trim(), parentId: (parentId as string | null | undefined) ?? null })
  }

  // L'auteur ou un éditeur/owner du document peut résoudre
  async resolve(userId: string, documentId: string, commentId: string): Promise<void> {
    const role = await this.access.getRole(userId, documentId)
    const comment = role ? await this.comments.findInDocument(commentId, documentId) : null
    if (!comment || (comment.authorId !== userId && !roleAllows(role, 'edit'))) throw notFound()
    await this.comments.resolve(commentId)
  }

  // L'auteur ou l'owner du document peut supprimer
  async delete(userId: string, documentId: string, commentId: string): Promise<void> {
    const role = await this.access.getRole(userId, documentId)
    const comment = role ? await this.comments.findInDocument(commentId, documentId) : null
    if (!comment || (comment.authorId !== userId && !roleAllows(role, 'manage'))) throw notFound()
    await this.comments.deleteWithReplies(commentId)
  }
}
