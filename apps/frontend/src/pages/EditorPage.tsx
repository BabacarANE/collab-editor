import { useEffect, useState, useRef } from 'react'
import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Collaboration from '@tiptap/extension-collaboration'
import * as Y from 'yjs'
import { WebsocketProvider } from 'y-websocket'
import { useAuthStore } from '../store/authStore'
import { api } from '../api/client'

interface Props {
  docId: string
  onBack: () => void
}

export default function EditorPage({ docId, onBack }: Props) {
  const { user, accessToken, logout } = useAuthStore()
  const [docTitle, setDocTitle] = useState('Sans titre')
  const [status, setStatus] = useState<'connecting' | 'connected' | 'disconnected'>('connecting')
  const [ydoc] = useState(() => new Y.Doc())
  const providerRef = useRef<WebsocketProvider | null>(null)
  const editorRef = useRef<ReturnType<typeof useEditor>>(null)

  // Charger le titre
  useEffect(() => {
    api.get(`/api/documents/${docId}`)
      .then(res => setDocTitle(res.data.title))
      .catch(() => setDocTitle('Document'))
  }, [docId])

  // Connexion WebSocket — une seule fois au montage
  useEffect(() => {
    const provider = new WebsocketProvider(
      'ws://localhost:4000',
      docId,
      ydoc,
      { params: { token: accessToken ?? '' } }
    )
    providerRef.current = provider

    provider.on('status', (event: { status: string }) => {
      setStatus(event.status as 'connecting' | 'connected' | 'disconnected')
    })

    return () => {
      provider.disconnect()
    }
  }, []) // [] = une seule fois, pas de dépendances

  const editor = useEditor({
    extensions: [
      StarterKit.configure({ history: false }),
      Collaboration.configure({ document: ydoc })
    ]
  })

  const statusColor = {
    connecting: '#f59e0b',
    connected: '#10b981',
    disconnected: '#ef4444'
  }[status]

  const statusLabel = {
    connecting: 'Connexion...',
    connected: 'Synchronisé',
    disconnected: 'Hors ligne'
  }[status]

  return (
    <div style={{ fontFamily: 'sans-serif' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 24px', borderBottom: '1px solid #eee' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <button
            onClick={onBack}
            style={{ padding: '6px 12px', cursor: 'pointer', background: 'none', border: '1px solid #ddd', borderRadius: 4 }}
          >
            ← Retour
          </button>
          <h3 style={{ margin: 0 }}>📄 {docTitle}</h3>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <div style={{ width: 8, height: 8, borderRadius: '50%', background: statusColor }} />
            <span style={{ fontSize: 13, color: '#666' }}>{statusLabel}</span>
          </div>
          <span style={{ color: '#666', fontSize: 14 }}>{user?.email}</span>
          <button onClick={logout} style={{ padding: '6px 12px', cursor: 'pointer' }}>
            Déconnexion
          </button>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 8, padding: '8px 24px', borderBottom: '1px solid #eee' }}>
        <button onClick={() => editor?.chain().focus().toggleBold().run()}
          style={{ fontWeight: editor?.isActive('bold') ? 'bold' : 'normal', padding: '4px 10px' }}>G</button>
        <button onClick={() => editor?.chain().focus().toggleItalic().run()}
          style={{ fontStyle: 'italic', padding: '4px 10px' }}>I</button>
        <button onClick={() => editor?.chain().focus().toggleHeading({ level: 1 }).run()}
          style={{ padding: '4px 10px' }}>H1</button>
        <button onClick={() => editor?.chain().focus().toggleHeading({ level: 2 }).run()}
          style={{ padding: '4px 10px' }}>H2</button>
        <button onClick={() => editor?.chain().focus().toggleBulletList().run()}
          style={{ padding: '4px 10px' }}>Liste</button>
        <button onClick={() => editor?.chain().focus().toggleCodeBlock().run()}
          style={{ padding: '4px 10px' }}>Code</button>
      </div>

      <div style={{ padding: 24, maxWidth: 800, margin: '0 auto' }}>
        <EditorContent editor={editor} />
      </div>
    </div>
  )
}