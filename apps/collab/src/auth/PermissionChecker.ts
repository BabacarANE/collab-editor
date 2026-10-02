export type DocumentRole = 'OWNER' | 'EDITOR' | 'COMMENTER' | 'VIEWER'

const WRITE_ROLES: readonly DocumentRole[] = ['OWNER', 'EDITOR']

export function canWrite(role: DocumentRole): boolean {
  return WRITE_ROLES.includes(role)
}

// Source des droits d'un utilisateur sur un document
export interface PermissionChecker {
  roleFor(docId: string, accessToken: string): Promise<DocumentRole | null>
}

// L'API reste la seule source de vérité sur les permissions
export class ApiPermissionChecker implements PermissionChecker {
  constructor(private readonly apiUrl: string, private readonly timeoutMs = 5000) {}

  async roleFor(docId: string, accessToken: string): Promise<DocumentRole | null> {
    try {
      const res = await fetch(`${this.apiUrl}/api/documents/${encodeURIComponent(docId)}/my-role`, {
        headers: { authorization: `Bearer ${accessToken}` },
        signal: AbortSignal.timeout(this.timeoutMs)
      })
      if (!res.ok) return null
      const body = await res.json() as { role?: DocumentRole }
      return body.role ?? null
    } catch (err) {
      console.error('[collab] Vérification des droits impossible:', (err as Error).message)
      return null
    }
  }
}
