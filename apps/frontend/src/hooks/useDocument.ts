import { useEffect, useState } from 'react'
import { documentsApi } from '../api/endpoints'
import { useWorkspaceStore } from '../store/workspaceStore'
import type { DocumentDetail, DocumentRole } from '../types'

// Document et rôle de l'utilisateur courant
export function useDocument(docId: string) {
  const [doc, setDoc] = useState<DocumentDetail | null>(null)
  const [role, setRole] = useState<DocumentRole | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    Promise.all([documentsApi.get(docId), documentsApi.myRole(docId)])
      .then(([detail, myRole]) => {
        setDoc(detail)
        setRole(myRole)
        // La barre latérale suit le workspace du document ouvert
        useWorkspaceStore.getState().selectWorkspace(detail.workspaceId).catch(() => {})
      })
      // 404 et 403 confondus volontairement : ne pas révéler l'existence du document
      .catch(() => setError('Document introuvable ou accès refusé'))
  }, [docId])

  return { doc, role, error }
}
