import { useEffect, useState } from 'react'
import type { Editor, EditorEvents } from '@tiptap/react'
import { ySyncPluginKey } from '@tiptap/y-tiptap'
import { documentsApi, notificationsApi } from '../api/endpoints'
import { createMentionTracker } from '../lib/mentionTracker'

export type SaveStatus = 'saved' | 'saving' | 'unsaved' | 'error'

const AUTOSAVE_DELAY_MS = 2000

// Sauvegarde automatique du HTML des modifications LOCALES (les changements
// reçus des collaborateurs sont sauvegardés par leur auteur), puis
// notification des nouvelles mentions
export function useAutosave(editor: Editor | null, docId: string, enabled: boolean, synced: boolean) {
  const [status, setStatus] = useState<SaveStatus>('saved')
  const [mentions] = useState(() =>
    createMentionTracker(userId => { notificationsApi.mention(docId, userId).catch(() => {}) })
  )

  useEffect(() => {
    if (!editor || !enabled) return
    let timer: ReturnType<typeof setTimeout> | null = null
    if (synced) mentions.initialize(editor.state.doc)

    const save = async () => {
      setStatus('saving')
      try {
        await documentsApi.saveContent(docId, editor.getHTML())
        setStatus('saved')
        mentions.notifyNew(editor.state.doc)
      } catch {
        setStatus('error')
      }
    }

    const onUpdate = ({ transaction }: EditorEvents['update']) => {
      const sync = transaction.getMeta(ySyncPluginKey) as { isChangeOrigin?: boolean } | undefined
      if (sync?.isChangeOrigin) return
      setStatus('unsaved')
      if (timer) clearTimeout(timer)
      timer = setTimeout(save, AUTOSAVE_DELAY_MS)
    }

    editor.on('update', onUpdate)
    return () => {
      editor.off('update', onUpdate)
      // Sauvegarde immédiate d'une modification en attente (fermeture, changement de rôle…)
      if (timer) {
        clearTimeout(timer)
        if (!editor.isDestroyed) save()
      }
    }
  }, [editor, enabled, docId, synced, mentions])

  return status
}
