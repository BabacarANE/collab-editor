import type { DocumentRole } from '../types'

export interface Capabilities {
  canEdit: boolean
  canComment: boolean
  // Résoudre les commentaires des autres
  canResolveAll: boolean
  // Supprimer les commentaires des autres, partager, supprimer le document
  canManage: boolean
}

// Miroir de la politique de l'API (domain/roles.ts) pour adapter l'interface ;
// l'API reste seule garante des droits
export function capabilitiesFor(role: DocumentRole | null): Capabilities {
  const canEdit = role === 'OWNER' || role === 'EDITOR'
  return {
    canEdit,
    canComment: canEdit || role === 'COMMENTER',
    canResolveAll: canEdit,
    canManage: role === 'OWNER'
  }
}

export const ROLE_BADGE: Partial<Record<DocumentRole, string>> = {
  VIEWER: 'Lecture seule',
  COMMENTER: 'Commentaires uniquement',
}
