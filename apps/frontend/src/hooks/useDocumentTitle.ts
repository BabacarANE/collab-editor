import { useEffect, useRef, useState } from 'react'
import type * as Y from 'yjs'
import { documentsApi } from '../api/endpoints'
import { useWorkspaceStore } from '../store/workspaceStore'

const SAVE_DELAY_MS = 600

// Titre synchronisé en direct entre collaborateurs (Yjs) et sauvegardé dans l'API
export function useDocumentTitle(docId: string, ydoc: Y.Doc, initialTitle: string | undefined) {
  const [localTitle, setLocalTitle] = useState<string | null>(null)
  const [failed, setFailed] = useState(false)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const title = localTitle ?? initialTitle ?? ''

  useEffect(() => {
    const meta = ydoc.getMap<string>('meta')
    const onChange = () => {
      const remote = meta.get('title')
      if (typeof remote !== 'string') return
      setLocalTitle(remote)
      // La barre latérale reflète aussi le titre modifié par un collaborateur
      useWorkspaceStore.getState().updateDocumentLocally(docId, { title: remote.trim() || 'Sans titre' })
    }
    meta.observe(onChange)
    return () => meta.unobserve(onChange)
  }, [ydoc, docId])

  const changeTitle = (value: string) => {
    setLocalTitle(value)
    ydoc.getMap('meta').set('title', value)
    if (timer.current) clearTimeout(timer.current)
    timer.current = setTimeout(async () => {
      const finalTitle = value.trim() || 'Sans titre'
      try {
        await documentsApi.rename(docId, finalTitle)
        setFailed(false)
        useWorkspaceStore.getState().updateDocumentLocally(docId, { title: finalTitle, updatedAt: new Date().toISOString() })
      } catch {
        setFailed(true)
      }
    }, SAVE_DELAY_MS)
  }

  return { title, changeTitle, failed }
}
