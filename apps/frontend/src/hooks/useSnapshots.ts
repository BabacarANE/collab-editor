import { useEffect, useState } from 'react'
import { documentsApi, snapshotsApi } from '../api/endpoints'
import type { Snapshot } from '../types'

// Versions nommées, chargées quand le panneau est ouvert
export function useSnapshots(docId: string, active: boolean) {
  const [snapshots, setSnapshots] = useState<Snapshot[]>([])

  useEffect(() => {
    if (active) snapshotsApi.list(docId).then(setSnapshots).catch(() => {})
  }, [docId, active])

  // Le contenu courant est enregistré avant d'être figé dans la version
  const save = async (name: string, currentHtml: string) => {
    await documentsApi.saveContent(docId, currentHtml)
    await snapshotsApi.create(docId, name || undefined)
    setSnapshots(await snapshotsApi.list(docId))
  }

  return { snapshots, save }
}
