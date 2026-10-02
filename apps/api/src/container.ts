import type { PrismaClient } from '@prisma/client'
import { CommentRepository } from './repositories/CommentRepository'
import { DocumentRepository } from './repositories/DocumentRepository'
import { NotificationRepository } from './repositories/NotificationRepository'
import { PermissionRepository } from './repositories/PermissionRepository'
import { RefreshTokenRepository } from './repositories/RefreshTokenRepository'
import { SearchRepository } from './repositories/SearchRepository'
import { SnapshotRepository } from './repositories/SnapshotRepository'
import { UserRepository } from './repositories/UserRepository'
import { WorkspaceRepository } from './repositories/WorkspaceRepository'
import { AccessService } from './services/AccessService'
import { AuthService } from './services/AuthService'
import { CommentService } from './services/CommentService'
import { DocumentService } from './services/DocumentService'
import { NotificationService } from './services/NotificationService'
import { PermissionService } from './services/PermissionService'
import { SearchService } from './services/SearchService'
import { SnapshotService } from './services/SnapshotService'
import { WorkspaceService } from './services/WorkspaceService'
import { ExportService } from './services/export/ExportService'
import { HtmlExporter, MarkdownExporter, PdfExporter } from './services/export/exporters'
import { ImportService } from './services/import/ImportService'
import { DocxConverter, MarkdownConverter, TextConverter } from './services/import/converters'
import type { PasswordHasher, PdfRenderer, TokenService } from './services/ports'

export interface ContainerDependencies {
  prisma: PrismaClient
  tokens: TokenService
  hasher: PasswordHasher
  pdfRenderer: PdfRenderer
  refreshTokenTtlMs: number
}

export type Services = ReturnType<typeof createServices>

// Racine de composition : seul endroit où les implémentations concrètes
// sont choisies et assemblées
export function createServices(deps: ContainerDependencies) {
  const { prisma } = deps

  const users = new UserRepository(prisma)
  const workspaces = new WorkspaceRepository(prisma)
  const documents = new DocumentRepository(prisma)
  const access = new AccessService(documents, workspaces)

  return {
    access,
    auth: new AuthService(users, new RefreshTokenRepository(prisma), deps.tokens, deps.hasher, deps.refreshTokenTtlMs),
    workspaces: new WorkspaceService(workspaces, users),
    documents: new DocumentService(documents, access),
    permissions: new PermissionService(new PermissionRepository(prisma), users, access),
    comments: new CommentService(new CommentRepository(prisma), access),
    snapshots: new SnapshotService(new SnapshotRepository(prisma), documents, access),
    notifications: new NotificationService(new NotificationRepository(prisma), users, documents, access),
    search: new SearchService(new SearchRepository(prisma)),
    imports: new ImportService(documents, access, [new MarkdownConverter(), new DocxConverter(), new TextConverter()]),
    exports: new ExportService(documents, access, [new HtmlExporter(), new MarkdownExporter(), new PdfExporter(deps.pdfRenderer)])
  }
}
