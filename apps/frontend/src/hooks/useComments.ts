import { useEffect, useState } from 'react'
import { commentsApi } from '../api/endpoints'
import type { Comment } from '../types'

// Fil de commentaires, chargé quand le panneau est ouvert
export function useComments(docId: string, active: boolean) {
  const [comments, setComments] = useState<Comment[]>([])

  useEffect(() => {
    if (active) commentsApi.list(docId).then(setComments).catch(() => {})
  }, [docId, active])

  const reload = async () => setComments(await commentsApi.list(docId))

  return {
    comments,
    post: async (content: string, parentId?: string) => { await commentsApi.create(docId, content, parentId); await reload() },
    resolve: async (id: string) => { await commentsApi.resolve(docId, id); await reload() },
    remove: async (id: string) => { await commentsApi.remove(docId, id); await reload() },
  }
}
