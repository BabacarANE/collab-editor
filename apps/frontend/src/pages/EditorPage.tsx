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

function userColor(userId: string): string {
  const colors = ['#F98181', '#FBBC88', '#FAF594', '#70CFF8', '#94FADB', '#B9F18D', '#C3ABF8']
  let hash = 0
  for (let i = 0; i < userId.length; i++) {
    hash = userId.charCodeAt(i) + ((hash << 5) - hash)
  }
  return colors[Math.abs(hash) % colors.length]
}

export default function EditorPage({ docId, onBack }: Props) {
  const { user, accessToken, logout } = useAuthStore()
  const [docTitle, setDocTitle] = useState('Sans titre')
  const [status, setStatus] = useState<'connecting' | 'connected' | 'disconnected'>('connecting')
  const [awarenessUsers, setAwarenessUsers] = useState<{ name: string; color: string }[]>([])
  const [ydoc] = useState(() => new Y.Doc())
  const [showHistory, setShowHistory] = useState(false)
  const [snapshots, setSnapshots] = useState<{ id: string; name: string; createdAt: string; author: { email: string } }[]>([])
  const [snapshotName, setSnapshotName] = useState('')
  const [previewSnapshot, setPreviewSnapshot] = useState<{ name: string; content: string; createdAt: string } | null>(null)
  const [showComments, setShowComments] = useState(false)
  const [comments, setComments] = useState<any[]>([])
  const [newComment, setNewComment] = useState('')
  const [replyTo, setReplyTo] = useState<{ id: string; email: string } | null>(null)
  const [replyContent, setReplyContent] = useState('')
  const providerRef = useRef<WebsocketProvider | null>(null)
  const [saveStatus, setSaveStatus] = useState<'saved' | 'saving' | 'unsaved'>('saved')
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Charger le titre
  useEffect(() => {
    api.get(`/api/documents/${docId}`)
      .then(res => setDocTitle(res.data.title))
      .catch(() => setDocTitle('Document'))
  }, [docId])

  // Connexion WebSocket + awareness
  useEffect(() => {
    const provider = new WebsocketProvider(
      'ws://localhost:4000',
      docId,
      ydoc,
      { params: { token: accessToken ?? '' } }
    )
    providerRef.current = provider

    provider.awareness.setLocalStateField('user', {
      name: user?.email ?? 'Anonyme',
      color: userColor(user?.id ?? 'anon')
    })

    provider.on('status', (event: { status: string }) => {
      setStatus(event.status as 'connecting' | 'connected' | 'disconnected')
    })

    const updateUsers = () => {
      const states = Array.from(provider.awareness.getStates().values()) as any[]
      const users = states
        .filter(s => s.user)
        .map(s => ({ name: s.user.name, color: s.user.color }))
      setAwarenessUsers(users)
    }

    provider.awareness.on('change', updateUsers)

    return () => {
      provider.disconnect()
    }
  }, [])

  // Initialiser l'éditeur
  const editor = useEditor({
    extensions: [
      StarterKit.configure({ history: false, undoRedo: false }),
      Collaboration.configure({ document: ydoc })
    ]
  })

  // Auto-save toutes les 5s après inactivité
  useEffect(() => {
    if (!editor) return

    const handleUpdate = () => {
      setSaveStatus('unsaved')
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
      saveTimerRef.current = setTimeout(async () => {
        setSaveStatus('saving')
        try {
          const html = editor.getHTML()
          await api.patch(`/api/documents/${docId}/content`, { content: html })
          setSaveStatus('saved')
        } catch {
          setSaveStatus('unsaved')
        }
      }, 5000)
    }

    editor.on('update', handleUpdate)

    return () => {
      editor.off('update', handleUpdate)
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
    }
  }, [editor, docId])

  const statusColor = { connecting: '#f59e0b', connected: '#10b981', disconnected: '#ef4444' }[status]
  const statusLabel = { connecting: 'Connexion...', connected: 'Synchronisé', disconnected: 'Hors ligne' }[status]

  const exportDocument = async (format: 'html' | 'md') => {
    try {
      const res = await api.get(`/api/documents/${docId}/export?format=${format}`, {
        responseType: 'blob'
      })
      const ext = format === 'html' ? 'html' : 'md'
      const url = window.URL.createObjectURL(new Blob([res.data]))
      const a = document.createElement('a')
      a.href = url
      a.download = `${docTitle}.${ext}`
      a.click()
      window.URL.revokeObjectURL(url)
    } catch {
      alert('Erreur export')
    }
  }

  const loadSnapshots = async () => {
    try {
      const res = await api.get(`/api/documents/${docId}/snapshots`)
      setSnapshots(res.data)
    } catch {
      console.error('Erreur chargement snapshots')
    }
  }

  const createSnapshot = async () => {
    try {
      await api.post(`/api/documents/${docId}/snapshots`, {
        name: snapshotName.trim() || undefined
      })
      setSnapshotName('')
      loadSnapshots()
    } catch {
      alert('Erreur création snapshot — le document doit être sauvegardé d\'abord')
    }
  }

  const viewSnapshot = async (snapshotId: string) => {
    try {
      const res = await api.get(`/api/documents/${docId}/snapshots/${snapshotId}`)
      setPreviewSnapshot(res.data)
    } catch {
      alert('Erreur chargement snapshot')
    }
  }

  const loadComments = async () => {
    try {
      const res = await api.get(`/api/documents/${docId}/comments`)
      setComments(res.data)
    } catch {
      console.error('Erreur chargement commentaires')
    }
  }

  const postComment = async () => {
    if (!newComment.trim()) return
    try {
      await api.post(`/api/documents/${docId}/comments`, { content: newComment.trim() })
      setNewComment('')
      loadComments()
    } catch {
      alert('Erreur envoi commentaire')
    }
  }

  const postReply = async (parentId: string) => {
    if (!replyContent.trim()) return
    try {
      await api.post(`/api/documents/${docId}/comments`, { content: replyContent.trim(), parentId })
      setReplyContent('')
      setReplyTo(null)
      loadComments()
    } catch {
      alert('Erreur envoi réponse')
    }
  }

  const resolveComment = async (commentId: string) => {
    try {
      await api.patch(`/api/documents/${docId}/comments/${commentId}/resolve`)
      loadComments()
    } catch {
      alert('Erreur résolution commentaire')
    }
  }

  return (
    <div style={{ fontFamily: 'sans-serif' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 24px', borderBottom: '1px solid #eee' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <button onClick={onBack} style={{ padding: '6px 12px', cursor: 'pointer', background: 'none', border: '1px solid #ddd', borderRadius: 4 }}>
            ← Retour
          </button>
          <h3 style={{ margin: 0 }}>📄 {docTitle}</h3>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>

          {/* Avatars collaborateurs */}
          <div style={{ display: 'flex', gap: 4 }}>
            {awarenessUsers.map((u, i) => (
              <div key={i} title={u.name} style={{
                width: 28, height: 28, borderRadius: '50%',
                background: u.color, display: 'flex',
                alignItems: 'center', justifyContent: 'center',
                fontSize: 12, fontWeight: 600, color: '#333',
                border: '2px solid white', cursor: 'default'
              }}>
                {u.name.charAt(0).toUpperCase()}
              </div>
            ))}
          </div>

          {/* Statut sauvegarde */}
          <span style={{ fontSize: 12, color: saveStatus === 'saved' ? '#10b981' : saveStatus === 'saving' ? '#f59e0b' : '#999' }}>
            {saveStatus === 'saved' ? '✓ Sauvegardé' : saveStatus === 'saving' ? 'Sauvegarde...' : '● Non sauvegardé'}
          </span>

          {/* Indicateur sync WebSocket */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <div style={{ width: 8, height: 8, borderRadius: '50%', background: statusColor }} />
            <span style={{ fontSize: 13, color: '#666' }}>{statusLabel}</span>
          </div>

          <span style={{ color: '#666', fontSize: 14 }}>{user?.email}</span>
          <button onClick={logout} style={{ padding: '6px 12px', cursor: 'pointer' }}>Déconnexion</button>
        </div>
      </div>

      {/* Toolbar */}
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
          
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
          <button onClick={() => exportDocument('html')}
            style={{ padding: '4px 10px', fontSize: 13, cursor: 'pointer', borderRadius: 4, border: '1px solid #ddd' }}>
            ↓ HTML
          </button>
          <button onClick={() => exportDocument('md')}
            style={{ padding: '4px 10px', fontSize: 13, cursor: 'pointer', borderRadius: 4, border: '1px solid #ddd' }}>
            ↓ Markdown
          </button>
        </div>
        <button
          onClick={() => { setShowHistory(!showHistory); if (!showHistory) loadSnapshots() }}
          style={{ padding: '4px 10px', fontSize: 13, cursor: 'pointer', borderRadius: 4, border: '1px solid #ddd', background: showHistory ? '#e8f0fe' : 'white' }}>
          🕐 Versions
        </button>
        <button
          onClick={() => { setShowComments(!showComments); if (!showComments) loadComments() }}
          style={{ padding: '4px 10px', fontSize: 13, cursor: 'pointer', borderRadius: 4, border: '1px solid #ddd', background: showComments ? '#e8f0fe' : 'white' }}>
          💬 Commentaires
        </button>
      
      </div>

      {/* Zone principale — éditeur + panel historique */}
        <div style={{ display: 'flex', flex: 1 }}>

          {/* Éditeur */}
          <div style={{ flex: 1, padding: 24, maxWidth: showHistory ? 'calc(100% - 300px)' : 800, margin: '0 auto' }}>
            <EditorContent editor={editor} />
          </div>

          {/* Panel historique */}
          {showHistory && (
            <div style={{ width: 300, borderLeft: '1px solid #eee', padding: 16, display: 'flex', flexDirection: 'column', gap: 12, overflowY: 'auto' }}>
              <div style={{ fontWeight: 600, fontSize: 14 }}>🕐 Historique des versions</div>


              

              {/* Créer un snapshot */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <input
                  placeholder="Nom de la version..."
                  value={snapshotName}
                  onChange={e => setSnapshotName(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && createSnapshot()}
                  style={{ padding: '6px 8px', fontSize: 13, borderRadius: 4, border: '1px solid #ddd' }}
                />
                <button onClick={createSnapshot}
                  style={{ padding: '6px 8px', fontSize: 13, cursor: 'pointer', borderRadius: 4, border: 'none', background: '#1a73e8', color: 'white' }}>
                  + Sauvegarder cette version
                </button>
              </div>

              <hr style={{ margin: '4px 0' }} />

              {/* Liste des snapshots */}
              {snapshots.length === 0 ? (
                <p style={{ color: '#999', fontSize: 13 }}>Aucune version sauvegardée</p>
              ) : (
                snapshots.map(s => (
                  <div key={s.id}
                    onClick={() => viewSnapshot(s.id)}
                    style={{ padding: '8px 12px', border: '1px solid #eee', borderRadius: 8, cursor: 'pointer', background: '#fafafa' }}>
                    <div style={{ fontWeight: 500, fontSize: 13 }}>{s.name}</div>
                    <div style={{ fontSize: 11, color: '#999', marginTop: 2 }}>
                      {new Date(s.createdAt).toLocaleDateString('fr-FR')} — {s.author.email}
                    </div>
                  </div>
                ))
              )}
            </div>



          )}
          {/* Panel commentaires */}
          {showComments && (
            <div style={{ width: 300, borderLeft: '1px solid #eee', padding: 16, display: 'flex', flexDirection: 'column', gap: 12, overflowY: 'auto' }}>
              <div style={{ fontWeight: 600, fontSize: 14 }}>💬 Commentaires</div>

              {/* Nouveau commentaire */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <textarea
                  placeholder="Ajouter un commentaire..."
                  value={newComment}
                  onChange={e => setNewComment(e.target.value)}
                  rows={3}
                  style={{ padding: '6px 8px', fontSize: 13, borderRadius: 4, border: '1px solid #ddd', resize: 'none' }}
                />
                <button onClick={postComment}
                  style={{ padding: '6px 8px', fontSize: 13, cursor: 'pointer', borderRadius: 4, border: 'none', background: '#1a73e8', color: 'white' }}>
                  + Commenter
                </button>
              </div>

              <hr style={{ margin: '4px 0' }} />

              {/* Liste des commentaires */}
              {comments.length === 0 ? (
                <p style={{ color: '#999', fontSize: 13 }}>Aucun commentaire</p>
              ) : (
                comments.map(c => (
                  <div key={c.id} style={{
                    padding: '10px 12px', border: '1px solid #eee', borderRadius: 8,
                    background: c.resolved ? '#f8f9fa' : 'white',
                    opacity: c.resolved ? 0.7 : 1
                  }}>
                    {/* Header commentaire */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                      <span style={{ fontSize: 11, fontWeight: 600, color: '#1a73e8' }}>{c.author.email}</span>
                      <span style={{ fontSize: 11, color: '#999' }}>{new Date(c.createdAt).toLocaleDateString('fr-FR')}</span>
                    </div>

                    {/* Contenu */}
                    <p style={{ margin: '0 0 8px', fontSize: 13, lineHeight: 1.5 }}>{c.content}</p>

                    {/* Réponses */}
                    {c.replies?.length > 0 && (
                      <div style={{ marginLeft: 12, borderLeft: '2px solid #eee', paddingLeft: 8, display: 'flex', flexDirection: 'column', gap: 6 }}>
                        {c.replies.map((r: any) => (
                          <div key={r.id}>
                            <span style={{ fontSize: 11, fontWeight: 600, color: '#666' }}>{r.author.email} </span>
                            <span style={{ fontSize: 12 }}>{r.content}</span>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Actions */}
                    {!c.resolved && (
                      <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                        <button onClick={() => setReplyTo(c)}
                          style={{ fontSize: 12, padding: '2px 8px', cursor: 'pointer', borderRadius: 4, border: '1px solid #ddd', background: 'none' }}>
                          Répondre
                        </button>
                        <button onClick={() => resolveComment(c.id)}
                          style={{ fontSize: 12, padding: '2px 8px', cursor: 'pointer', borderRadius: 4, border: '1px solid #10b981', color: '#10b981', background: 'none' }}>
                          ✓ Résoudre
                        </button>
                      </div>
                    )}
                    {c.resolved && <span style={{ fontSize: 11, color: '#10b981' }}>✓ Résolu</span>}

                    {/* Zone de réponse */}
                    {replyTo?.id === c.id && (
                      <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 4 }}>
                        <textarea
                          placeholder="Votre réponse..."
                          value={replyContent}
                          onChange={e => setReplyContent(e.target.value)}
                          rows={2}
                          style={{ padding: '4px 8px', fontSize: 12, borderRadius: 4, border: '1px solid #ddd', resize: 'none' }}
                        />
                        <div style={{ display: 'flex', gap: 4 }}>
                          <button onClick={() => postReply(c.id)}
                            style={{ fontSize: 12, padding: '4px 8px', cursor: 'pointer', borderRadius: 4, border: 'none', background: '#1a73e8', color: 'white' }}>
                            Envoyer
                          </button>
                          <button onClick={() => setReplyTo(null)}
                            style={{ fontSize: 12, padding: '4px 8px', cursor: 'pointer', borderRadius: 4, border: '1px solid #ddd', background: 'none' }}>
                            Annuler
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          )}





        </div>

        {/* Modal preview snapshot */}
        {previewSnapshot && (
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }}>
            <div style={{ background: 'white', borderRadius: 12, padding: 24, width: '70vw', maxHeight: '80vh', overflow: 'auto', display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h3 style={{ margin: 0 }}>📄 {previewSnapshot.name}</h3>
                <button onClick={() => setPreviewSnapshot(null)}
                  style={{ background: 'none', border: 'none', fontSize: 18, cursor: 'pointer', color: '#666' }}>✕</button>
              </div>
              <div style={{ fontSize: 12, color: '#999' }}>
                {new Date(previewSnapshot.createdAt).toLocaleDateString('fr-FR')}
              </div>
              <div
                style={{ padding: 16, border: '1px solid #eee', borderRadius: 8, lineHeight: 1.6 }}
                dangerouslySetInnerHTML={{ __html: previewSnapshot.content }}
              />
            </div>
          </div>
        )}
    </div>
  )
}