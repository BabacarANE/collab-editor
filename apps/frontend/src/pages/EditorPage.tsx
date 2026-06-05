import { useEffect, useState, useRef } from 'react'
import { useEditor, EditorContent, ReactRenderer } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Collaboration from '@tiptap/extension-collaboration'
import Mention from '@tiptap/extension-mention'
import * as Y from 'yjs'
import { WebsocketProvider } from 'y-websocket'
import tippy from 'tippy.js'
import { useAuthStore } from '../store/authStore'
import { api } from '../api/client'
import EditorToolbar from '../components/EditorToolbar'
import HistoryPanel from '../components/HistoryPanel'
import CommentsPanel from '../components/CommentsPanel'
import MentionList from '../components/MentionList'
import SnapshotDiff from '../components/SnapshotDiff'
import DocumentPermissions from '../components/DocumentPermissions'
import NotificationBell from '../components/NotificationBell'

interface Props {
  docId: string
  onBack: () => void
  workspaceId: string
}

function userColor(userId: string): string {
  const colors = ['#F98181', '#FBBC88', '#FAF594', '#70CFF8', '#94FADB', '#B9F18D', '#C3ABF8']
  let hash = 0
  for (let i = 0; i < userId.length; i++) hash = userId.charCodeAt(i) + ((hash << 5) - hash)
  return colors[Math.abs(hash) % colors.length]
}

export default function EditorPage({ docId, onBack, workspaceId }: Props) {
  const { user, accessToken, logout } = useAuthStore()
  const [docTitle, setDocTitle] = useState('Sans titre')
  const [myRole, setMyRole] = useState('OWNER')
  const [status, setStatus] = useState<'connecting' | 'connected' | 'disconnected'>('connecting')
  const [awarenessUsers, setAwarenessUsers] = useState<{ name: string; color: string }[]>([])
  const [ydoc] = useState(() => new Y.Doc())
  const [saveStatus, setSaveStatus] = useState<'saved' | 'saving' | 'unsaved'>('saved')
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const editorRef = useRef<any>(null)

  // Panels
  const [showHistory, setShowHistory] = useState(false)
  const [showComments, setShowComments] = useState(false)
  const [showPermissions, setShowPermissions] = useState(false)
  const [showDiff, setShowDiff] = useState(false)

  // Snapshots
  const [snapshots, setSnapshots] = useState<any[]>([])
  const [snapshotName, setSnapshotName] = useState('')
  const [previewSnapshot, setPreviewSnapshot] = useState<any>(null)

  // Comments
  const [comments, setComments] = useState<any[]>([])
  const [newComment, setNewComment] = useState('')
  const [replyTo, setReplyTo] = useState<{ id: string; email: string } | null>(null)
  const [replyContent, setReplyContent] = useState('')

  // Charger titre + rôle
  useEffect(() => {
    const load = async () => {
      try {
        const [docRes, roleRes] = await Promise.all([
          api.get(`/api/documents/${docId}`),
          api.get(`/api/documents/${docId}/my-role`)
        ])
        setDocTitle(docRes.data.title)
        setMyRole(roleRes.data.role)
      } catch {
        setDocTitle('Document')
      }
    }
    load()
  }, [docId])

  // WebSocket + awareness
  useEffect(() => {
    const provider = new WebsocketProvider('ws://localhost:4000', docId, ydoc, {
      params: { token: accessToken ?? '' }
    })
    provider.awareness.setLocalStateField('user', {
      name: user?.email ?? 'Anonyme',
      color: userColor(user?.id ?? 'anon')
    })
    provider.on('status', (e: { status: string }) =>
      setStatus(e.status as 'connecting' | 'connected' | 'disconnected')
    )
    provider.on('synced', async () => {
      const isEmpty = ydoc.getXmlFragment('default').length === 0
      if (isEmpty) {
        try {
          const res = await api.get(`/api/documents/${docId}`)
          if (res.data.content?.trim() && editorRef.current) {
            editorRef.current.commands.setContent(res.data.content)
          }
        } catch { /* silencieux */ }
      }
    })
    provider.awareness.on('change', () => {
      const states = Array.from(provider.awareness.getStates().values()) as any[]
      setAwarenessUsers(states.filter(s => s.user).map(s => ({ name: s.user.name, color: s.user.color })))
    })
    return () => provider.disconnect()
  }, [])

  const provider = new WebsocketProvider(
    import.meta.env.VITE_COLLAB_URL ?? 'ws://localhost:4000',
    docId,
    ydoc,
    { params: { token: accessToken ?? '' } }
  )

  // Éditeur
  const editor = useEditor({
    extensions: [
      StarterKit.configure({ history: false, undoRedo: false }),
      Collaboration.configure({ document: ydoc }),
      Mention.configure({
        HTMLAttributes: { class: 'mention' },
        suggestion: {
          items: async ({ query }: { query: string }) => {
            try {
              const res = await api.get(`/api/workspaces/${workspaceId}`)
              return (res.data.members as any[])
                .map((m: any) => ({ id: m.user.id, label: m.user.email }))
                .filter((m: any) => m.label.toLowerCase().includes(query.toLowerCase()))
                .slice(0, 8)
            } catch { return [] }
          },
          render: () => {
            let component: ReactRenderer
            let popup: any
            return {
              onStart: (props: any) => {
                component = new ReactRenderer(MentionList, { props, editor: props.editor })
                popup = tippy('body', {
                  getReferenceClientRect: props.clientRect,
                  appendTo: () => document.body,
                  content: component.element,
                  showOnCreate: true,
                  interactive: true,
                  trigger: 'manual',
                  placement: 'bottom-start',
                })
              },
              onUpdate: (props: any) => {
                component.updateProps(props)
                popup[0].setProps({ getReferenceClientRect: props.clientRect })
              },
              onKeyDown: (props: any) => {
                if (props.event.key === 'Escape') { popup[0].hide(); return true }
                return (component.ref as any)?.onKeyDown?.(props) ?? false
              },
              onExit: () => { popup[0].destroy(); component.destroy() }
            }
          }
        }
      })
    ]
  })

  useEffect(() => { if (editor) editorRef.current = editor }, [editor])

  useEffect(() => {
    if (!editor) return
    editor.setEditable(myRole !== 'VIEWER' && myRole !== 'COMMENTER')
  }, [editor, myRole])

  // Auto-save
  useEffect(() => {
    if (!editor) return
    const handleUpdate = () => {
      if (myRole === 'VIEWER' || myRole === 'COMMENTER') return
      setSaveStatus('unsaved')
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
      saveTimerRef.current = setTimeout(async () => {
        setSaveStatus('saving')
        try {
          const html = editor.getHTML()
          await api.patch(`/api/documents/${docId}/content`, { content: html })
          const mentionEls = editor.getJSON().content
            ?.flatMap((n: any) => n.content ?? [])
            ?.filter((n: any) => n.type === 'mention') ?? []
          if (mentionEls.length > 0) {
            const docRes = await api.get(`/api/documents/${docId}`)
            await Promise.allSettled(mentionEls.map((m: any) =>
              api.post('/api/notifications/mention', {
                mentionedUserId: m.attrs.id,
                documentId: docId,
                documentTitle: docRes.data.title
              })
            ))
          }
          setSaveStatus('saved')
        } catch { setSaveStatus('unsaved') }
      }, 5000)
    }
    editor.on('update', handleUpdate)
    return () => {
      editor.off('update', handleUpdate)
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
    }
  }, [editor, docId, myRole])

  // Snapshots
  const loadSnapshots = async () => {
    const res = await api.get(`/api/documents/${docId}/snapshots`)
    const withContent = await Promise.all(
      res.data.map(async (s: any) => {
        const d = await api.get(`/api/documents/${docId}/snapshots/${s.id}`)
        return d.data
      })
    )
    setSnapshots(withContent)
  }

  const createSnapshot = async () => {
    try {
      await api.post(`/api/documents/${docId}/snapshots`, { name: snapshotName.trim() || undefined })
      setSnapshotName('')
      loadSnapshots()
    } catch { alert('Erreur création snapshot') }
  }

  const viewSnapshot = async (snapshotId: string) => {
    const res = await api.get(`/api/documents/${docId}/snapshots/${snapshotId}`)
    setPreviewSnapshot(res.data)
  }

  // Comments
  const loadComments = async () => {
    const res = await api.get(`/api/documents/${docId}/comments`)
    setComments(res.data)
  }

  const postComment = async () => {
    if (!newComment.trim()) return
    await api.post(`/api/documents/${docId}/comments`, { content: newComment.trim() })
    setNewComment('')
    loadComments()
  }

  const postReply = async (parentId: string) => {
    if (!replyContent.trim()) return
    await api.post(`/api/documents/${docId}/comments`, { content: replyContent.trim(), parentId })
    setReplyContent('')
    setReplyTo(null)
    loadComments()
  }

  const resolveComment = async (commentId: string) => {
    await api.patch(`/api/documents/${docId}/comments/${commentId}/resolve`)
    loadComments()
  }

  const exportDocument = async (format: 'html' | 'md' | 'pdf') => {
    const res = await api.get(`/api/documents/${docId}/export?format=${format}`, { responseType: 'blob' })
    const ext = format
    const url = window.URL.createObjectURL(new Blob([res.data]))
    const a = document.createElement('a')
    a.href = url
    a.download = `${docTitle}.${ext}`
    a.click()
    window.URL.revokeObjectURL(url)
  }

  const statusColor = { connecting: 'bg-yellow-400', connected: 'bg-emerald-400', disconnected: 'bg-red-400' }[status]
  const statusLabel = { connecting: 'Connexion...', connected: 'Synchronisé', disconnected: 'Hors ligne' }[status]
  const saveLabel = { saved: '✓ Sauvegardé', saving: 'Sauvegarde...', unsaved: '● Non sauvegardé' }[saveStatus]
  const saveColor = { saved: 'text-emerald-500', saving: 'text-yellow-500', unsaved: 'text-gray-400' }[saveStatus]

  return (
    <div className="flex flex-col h-screen bg-white font-sans">

      {/* Header */}
      <header className="flex items-center justify-between px-6 py-2.5 border-b border-gray-200 bg-white shadow-sm">
        <div className="flex items-center gap-3">
          <button
            onClick={onBack}
            className="flex items-center gap-1.5 text-sm text-gray-600 hover:text-gray-900 px-2.5 py-1.5 rounded hover:bg-gray-100 transition-colors border border-gray-200"
          >
            ← Retour
          </button>
          <div className="flex items-center gap-2">
            <span className="text-gray-400">📄</span>
            <span className="font-medium text-gray-800 text-sm">{docTitle}</span>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {/* Avatars collaborateurs */}
          <div className="flex -space-x-1.5">
            {awarenessUsers.map((u, i) => (
              <div
                key={i}
                title={u.name}
                style={{ background: u.color }}
                className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-semibold text-gray-800 border-2 border-white shadow-sm"
              >
                {u.name.charAt(0).toUpperCase()}
              </div>
            ))}
          </div>

          {/* Statut sauvegarde */}
          <span className={`text-xs ${saveColor}`}>{saveLabel}</span>

          {/* Statut sync */}
          <div className="flex items-center gap-1.5">
            <div className={`w-2 h-2 rounded-full ${statusColor}`} />
            <span className="text-xs text-gray-500">{statusLabel}</span>
          </div>

          <NotificationBell onOpenDocument={() => {}} />

          <span className="text-sm text-gray-500">{user?.email}</span>
          <button
            onClick={logout}
            className="text-sm text-gray-500 hover:text-gray-800 px-2.5 py-1.5 rounded hover:bg-gray-100 transition-colors border border-gray-200"
          >
            Déconnexion
          </button>
        </div>
      </header>

      {/* Bandeau lecture seule */}
      {(myRole === 'VIEWER' || myRole === 'COMMENTER') && (
        <div className="px-6 py-2 bg-yellow-50 border-b border-yellow-200 text-sm text-yellow-800 flex items-center gap-2">
          {myRole === 'VIEWER'
            ? '👁 Mode lecture seule'
            : '💬 Mode commentaire uniquement — édition désactivée'}
        </div>
      )}

      {/* Toolbar */}
      <EditorToolbar
        editor={editor}
        myRole={myRole}
        showHistory={showHistory}
        showComments={showComments}
        showPermissions={showPermissions}
        onToggleHistory={() => { setShowHistory(!showHistory); if (!showHistory) loadSnapshots() }}
        onToggleComments={() => { setShowComments(!showComments); if (!showComments) loadComments() }}
        onTogglePermissions={() => setShowPermissions(!showPermissions)}
        onExport={exportDocument}
      />

      {/* Zone principale */}
      <div className="flex flex-1 overflow-hidden">

        {/* Éditeur */}
        <div className="flex-1 overflow-y-auto bg-gray-50">
          <div className="max-w-3xl mx-auto bg-white shadow-sm min-h-full">
            <EditorContent editor={editor} />
          </div>
        </div>

        {/* Panel Versions */}
        {showHistory && (
          <HistoryPanel
            snapshots={snapshots}
            snapshotName={snapshotName}
            onSnapshotNameChange={setSnapshotName}
            onCreateSnapshot={createSnapshot}
            onViewSnapshot={viewSnapshot}
            onShowDiff={() => setShowDiff(true)}
          />
        )}

        {/* Panel Commentaires */}
        {showComments && (
          <CommentsPanel
            comments={comments}
            newComment={newComment}
            replyTo={replyTo}
            replyContent={replyContent}
            onNewCommentChange={setNewComment}
            onPostComment={postComment}
            onSetReplyTo={setReplyTo}
            onReplyContentChange={setReplyContent}
            onPostReply={postReply}
            onResolve={resolveComment}
          />
        )}
      </div>

      {/* Modals */}
      {previewSnapshot && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 w-[70vw] max-h-[80vh] overflow-auto flex flex-col gap-4">
            <div className="flex justify-between items-center">
              <h3 className="font-semibold text-gray-800">📄 {previewSnapshot.name}</h3>
              <button onClick={() => setPreviewSnapshot(null)} className="text-gray-400 hover:text-gray-700 text-lg">✕</button>
            </div>
            <div className="text-xs text-gray-400">
              {new Date(previewSnapshot.createdAt).toLocaleDateString('fr-FR')}
            </div>
            <div
              className="p-4 border border-gray-200 rounded-lg leading-relaxed text-sm"
              dangerouslySetInnerHTML={{ __html: previewSnapshot.content }}
            />
          </div>
        </div>
      )}

      {showDiff && (
        <SnapshotDiff snapshots={snapshots} onClose={() => setShowDiff(false)} />
      )}

      {showPermissions && (
        <DocumentPermissions
          docId={docId}
          docTitle={docTitle}
          workspaceId={workspaceId}
          onClose={() => setShowPermissions(false)}
        />
      )}
    </div>
  )
}