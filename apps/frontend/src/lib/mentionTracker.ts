import type { Node as ProseMirrorNode } from '@tiptap/pm/model'

export function mentionIds(doc: ProseMirrorNode): Set<string> {
  const ids = new Set<string>()
  doc.descendants(node => {
    if (node.type.name === 'mention' && node.attrs.id) ids.add(node.attrs.id)
  })
  return ids
}

// Ne notifie que les mentions ajoutées depuis l'ouverture du document
export function createMentionTracker(notify: (userId: string) => void) {
  let known: Set<string> | null = null

  return {
    // Mentions présentes à l'ouverture : déjà connues, pas de notification
    initialize(doc: ProseMirrorNode) {
      known ??= mentionIds(doc)
    },
    notifyNew(doc: ProseMirrorNode) {
      const current = mentionIds(doc)
      if (!known) {
        known = current
        return
      }
      for (const id of current) {
        if (known.has(id)) continue
        known.add(id)
        notify(id)
      }
    }
  }
}
