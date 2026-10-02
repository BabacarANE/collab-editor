import { workspacesApi } from '../api/endpoints'

export interface MemberOption {
  id: string
  label: string
}

// Recherche de membres pour les mentions, avec cache par workspace
export function createMemberSearch(getWorkspaceId: () => string | null) {
  const cache = new Map<string, MemberOption[]>()

  return async (query: string): Promise<MemberOption[]> => {
    const workspaceId = getWorkspaceId()
    if (!workspaceId) return []
    if (!cache.has(workspaceId)) {
      try {
        const members = await workspacesApi.members(workspaceId)
        cache.set(workspaceId, members.map(m => ({ id: m.user.id, label: m.user.email })))
      } catch {
        return []
      }
    }
    const q = query.toLowerCase()
    return (cache.get(workspaceId) ?? []).filter(m => m.label.toLowerCase().includes(q)).slice(0, 8)
  }
}
