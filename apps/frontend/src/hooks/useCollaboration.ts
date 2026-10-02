import { useEffect, useState } from 'react'
import { getFreshAccessToken } from '../api/client'
import { CollabSession } from '../lib/collabSession'

export type ConnectionStatus = 'connecting' | 'connected' | 'disconnected'

export interface Collaborator {
  clientId: number
  name: string
  color: string
}

const SERVER_URL = import.meta.env.VITE_COLLAB_URL ?? 'ws://localhost:4000'

// État React d'une session de collaboration (connexion, synchro, présence).
// Le composant appelant doit être remonté (key) quand docId change.
export function useCollaboration(docId: string) {
  const [session] = useState(() => new CollabSession(SERVER_URL, docId, getFreshAccessToken))
  const [status, setStatus] = useState<ConnectionStatus>('connecting')
  const [synced, setSynced] = useState(false)
  const [collaborators, setCollaborators] = useState<Collaborator[]>([])

  useEffect(() => {
    const { provider, ydoc } = session

    const onStatus = ({ status }: { status: ConnectionStatus }) => setStatus(status)
    const onSync = (isSynced: boolean) => setSynced(isSynced)
    const onAwareness = () => {
      const others: Collaborator[] = []
      provider.awareness.getStates().forEach((state, clientId) => {
        if (clientId !== ydoc.clientID && state.user) {
          others.push({ clientId, name: state.user.name, color: state.user.color })
        }
      })
      setCollaborators(others)
    }

    provider.on('status', onStatus)
    provider.on('sync', onSync)
    provider.awareness.on('change', onAwareness)
    session.connect().catch(() => setStatus('disconnected'))

    return () => session.destroy()
  }, [session])

  return { ydoc: session.ydoc, provider: session.provider, status, synced, collaborators }
}
