import { useCallback, useEffect, useRef, useState } from 'react'
import { EditorContent, useEditor, useEditorState, type EditorEvents } from '@tiptap/react'
import { ySyncPluginKey } from '@tiptap/y-tiptap'
import {
  CloudOff, Download, FileText, History, Link2, Loader2, Menu as MenuIcon,
  MessageSquare, MoreHorizontal, Trash2, Users
} from 'lucide-react'
import { api } from '../api/client'
import { colorFor, relativeTime } from '../lib/format'
import { documentUrl, navigate } from '../lib/router'
import { useAuthStore } from '../store/authStore'
import { useWorkspaceStore } from '../store/workspaceStore'
import { useCollaboration } from '../hooks/useCollaboration'
import { createMemberSearch } from '../lib/memberSearch'
import type { Comment, DocumentDetail, DocumentRole, Snapshot } from '../types'
import { buildExtensions } from '../components/editor/extensions'
import FormatToolbar from '../components/editor/FormatToolbar'
import CommentsPanel from '../components/editor/CommentsPanel'
import HistoryPanel from '../components/editor/HistoryPanel'
import ShareDialog from '../components/dialogs/ShareDialog'
import SnapshotDiffDialog from '../components/dialogs/SnapshotDiffDialog'
import SnapshotPreviewDialog from '../components/dialogs/SnapshotPreviewDialog'
import NotificationBell from '../components/layout/NotificationBell'
import { Avatar } from '../components/ui/Avatar'
import { Button, IconButton } from '../components/ui/Button'
import { Menu, MenuItem, MenuLabel, MenuSeparator } from '../components/ui/Menu'

interface Props {
  docId: string
  sidebarOpen: boolean
  openSidebar: () => void
}

type Panel = 'comments' | 'history' | null
type SaveStatus = 'saved' | 'saving' | 'unsaved' | 'error'

const AUTOSAVE_DELAY_MS = 2000
const TITLE_SAVE_DELAY_MS = 600

const ROLE_BADGE: Partial<Record<DocumentRole, string>> = {
  VIEWER: 'Lecture seule',
  COMMENTER: 'Commentaires uniquement',
}

export default function EditorPage({ docId, sidebarOpen, openSidebar }: Props) {
  const user = useAuthStore(s => s.user)
  const { ydoc, provider, status, synced, collaborators } = useCollaboration(docId)

  const [doc, setDoc] = useState<DocumentDetail | null>(null)
  const [role, setRole] = useState<DocumentRole | null>(null)
  const [loadError, setLoadError] = useState('')
  const [title, setTitle] = useState('')
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('saved')
  const [panel, setPanel] = useState<Panel>(null)
  const [dialog, setDialog] = useState<'share' | 'diff' | null>(null)
  const [previewSnapshot, setPreviewSnapshot] = useState<Snapshot | null>(null)
  const [comments, setComments] = useState<Comment[]>([])
  const [snapshots, setSnapshots] = useState<Snapshot[]>([])

  const canEdit = role === 'OWNER' || role === 'EDITOR'
  const canComment = canEdit || role === 'COMMENTER'
  const [searchMembers] = useState(() => createMemberSearch(() => useWorkspaceStore.getState().activeWorkspaceId))
  const notifiedMentionsRef = useRef<Set<string> | null>(null)

  // ─── Chargement du document et du rôle ────────────────────────────────────
  useEffect(() => {
    Promise.all([
      api.get<DocumentDetail>(`/api/documents/${docId}`),
      api.get<{ role: DocumentRole }>(`/api/documents/${docId}/my-role`)
    ])
      .then(([docRes, roleRes]) => {
        setDoc(docRes.data)
        setTitle(docRes.data.title)
        setRole(roleRes.data.role)
        useWorkspaceStore.getState().selectWorkspace(docRes.data.workspaceId).catch(() => {})
      })
      // 404 et 403 confondus volontairement : ne pas révéler l'existence du document
      .catch(() => setLoadError('Document introuvable ou accès refusé'))
  }, [docId])

  // ─── Éditeur collaboratif ─────────────────────────────────────────────────
  const editor = useEditor({
    editable: false,
    extensions: buildExtensions({
      ydoc,
      provider,
      user: { name: user?.email.split('@')[0] ?? 'Anonyme', color: colorFor(user?.id ?? 'anon') },
      searchMentions: searchMembers
    }),
    editorProps: { attributes: { class: 'document-body', spellcheck: 'true' } }
  })

  useEffect(() => {
    editor?.setEditable(canEdit)
  }, [editor, canEdit])

  // Initialisation depuis le HTML sauvegardé, une seule fois par document :
  // le drapeau Yjs partagé évite qu'un second client ne duplique le contenu
  useEffect(() => {
    if (!editor || !synced || !doc || !canEdit) return
    const meta = ydoc.getMap('meta')
    if (meta.get('initialized') || ydoc.getXmlFragment('default').length > 0) return
    if (doc.content?.trim()) {
      ydoc.transact(() => meta.set('initialized', true))
      editor.commands.setContent(doc.content)
    }
  }, [editor, synced, doc, canEdit, ydoc])

  // ─── Titre synchronisé en direct via Yjs + sauvegarde API ─────────────────
  useEffect(() => {
    const meta = ydoc.getMap<string>('meta')
    const onChange = () => {
      const remote = meta.get('title')
      if (typeof remote !== 'string') return
      setTitle(remote)
      // La barre latérale reflète aussi le titre modifié par un collaborateur
      useWorkspaceStore.getState().updateDocumentLocally(docId, { title: remote.trim() || 'Sans titre' })
    }
    meta.observe(onChange)
    return () => meta.unobserve(onChange)
  }, [ydoc, docId])

  const titleTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const changeTitle = (value: string) => {
    setTitle(value)
    ydoc.getMap('meta').set('title', value)
    if (titleTimer.current) clearTimeout(titleTimer.current)
    titleTimer.current = setTimeout(async () => {
      const finalTitle = value.trim() || 'Sans titre'
      try {
        await api.patch(`/api/documents/${docId}`, { title: finalTitle })
        useWorkspaceStore.getState().updateDocumentLocally(docId, { title: finalTitle, updatedAt: new Date().toISOString() })
      } catch { setSaveStatus('error') }
    }, TITLE_SAVE_DELAY_MS)
  }

  // ─── Sauvegarde automatique (uniquement pour les modifications locales) ──
  useEffect(() => {
    if (!editor || !canEdit) return
    let timer: ReturnType<typeof setTimeout> | null = null

    const save = async () => {
      setSaveStatus('saving')
      try {
        await api.patch(`/api/documents/${docId}/content`, { content: editor.getHTML() })
        setSaveStatus('saved')
        notifyNewMentions()
      } catch {
        setSaveStatus('error')
      }
    }

    const onUpdate = ({ transaction }: EditorEvents['update']) => {
      // Les changements reçus des collaborateurs sont sauvegardés par leur auteur
      const sync = transaction.getMeta(ySyncPluginKey) as { isChangeOrigin?: boolean } | undefined
      if (sync?.isChangeOrigin) return
      setSaveStatus('unsaved')
      if (timer) clearTimeout(timer)
      timer = setTimeout(save, AUTOSAVE_DELAY_MS)
    }

    // Notifie uniquement les mentions ajoutées depuis l'ouverture du document
    const notifyNewMentions = () => {
      const ids = new Set<string>()
      editor.state.doc.descendants(node => {
        if (node.type.name === 'mention' && node.attrs.id) ids.add(node.attrs.id)
      })
      if (!notifiedMentionsRef.current) {
        notifiedMentionsRef.current = ids
        return
      }
      for (const id of ids) {
        if (notifiedMentionsRef.current.has(id)) continue
        notifiedMentionsRef.current.add(id)
        api.post('/api/notifications/mention', { mentionedUserId: id, documentId: docId }).catch(() => {})
      }
    }

    // Mentions déjà présentes à l'ouverture : pas de nouvelle notification
    if (synced && !notifiedMentionsRef.current) {
      notifiedMentionsRef.current = new Set()
      editor.state.doc.descendants(node => {
        if (node.type.name === 'mention' && node.attrs.id) notifiedMentionsRef.current!.add(node.attrs.id)
      })
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
  }, [editor, canEdit, docId, synced])

  // ─── Commentaires ─────────────────────────────────────────────────────────
  const fetchComments = useCallback(
    () => api.get<Comment[]>(`/api/documents/${docId}/comments`).then(res => res.data),
    [docId]
  )
  const loadComments = async () => setComments(await fetchComments())

  const postComment = async (content: string, parentId?: string) => {
    await api.post(`/api/documents/${docId}/comments`, { content, parentId })
    await loadComments()
  }

  // ─── Versions ─────────────────────────────────────────────────────────────
  const fetchSnapshots = useCallback(
    () => api.get<Snapshot[]>(`/api/documents/${docId}/snapshots`).then(res => res.data),
    [docId]
  )
  const loadSnapshots = async () => setSnapshots(await fetchSnapshots())

  const saveSnapshot = async (name: string) => {
    // Sauvegarde du contenu courant avant de figer la version
    if (editor) await api.patch(`/api/documents/${docId}/content`, { content: editor.getHTML() })
    await api.post(`/api/documents/${docId}/snapshots`, { name: name || undefined })
    await loadSnapshots()
  }

  useEffect(() => {
    if (panel === 'comments') fetchComments().then(setComments).catch(() => {})
    if (panel === 'history') fetchSnapshots().then(setSnapshots).catch(() => {})
  }, [panel, fetchComments, fetchSnapshots])

  // ─── Export et suppression ────────────────────────────────────────────────
  const exportDocument = async (format: 'html' | 'md' | 'pdf') => {
    const res = await api.get(`/api/documents/${docId}/export?format=${format}`, { responseType: 'blob' })
    const url = URL.createObjectURL(res.data)
    const a = document.createElement('a')
    a.href = url
    a.download = `${title || 'document'}.${format}`
    a.click()
    URL.revokeObjectURL(url)
  }

  const deleteDocument = async () => {
    if (!confirm(`Supprimer « ${title} » ? Cette action est irréversible.`)) return
    await useWorkspaceStore.getState().deleteDocument(docId)
    navigate({ name: 'home' })
  }

  const words = useEditorState({
    editor,
    selector: ({ editor: e }) => e?.storage.characterCount?.words?.() ?? 0
  })

  if (loadError) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 px-6 text-center">
        <FileText size={40} className="text-ink-muted" />
        <h1 className="text-lg font-semibold text-ink">{loadError}</h1>
        <p className="text-sm text-ink-soft">Vérifiez le lien ou demandez l'accès au propriétaire du document.</p>
        <Button onClick={() => navigate({ name: 'home' })}>Retour à l'accueil</Button>
      </div>
    )
  }

  return (
    <div className="flex h-full flex-col">
      {/* ─── Barre supérieure ─── */}
      <header className="flex h-12 shrink-0 items-center gap-2 border-b border-line bg-white px-3">
        {!sidebarOpen && (
          <IconButton label="Afficher la barre latérale" onClick={openSidebar}><MenuIcon size={18} /></IconButton>
        )}
        <div className="flex min-w-0 flex-1 items-center gap-2">
          <FileText size={16} className="shrink-0 text-accent" />
          <span className="truncate text-sm text-ink">{title || 'Sans titre'}</span>
          {role && ROLE_BADGE[role] && (
            <span className="shrink-0 rounded-full bg-canvas px-2 py-0.5 text-xs text-ink-soft">{ROLE_BADGE[role]}</span>
          )}
          <SaveIndicator status={status} saveStatus={saveStatus} canEdit={canEdit} updatedAt={doc?.updatedAt} />
        </div>

        {/* Présence des collaborateurs */}
        <div className="hidden items-center -space-x-1.5 sm:flex">
          {collaborators.slice(0, 4).map(c => (
            <Avatar key={c.clientId} email={c.name} color={c.color} size={28} ring />
          ))}
          {collaborators.length > 4 && (
            <span className="flex h-7 w-7 items-center justify-center rounded-full bg-canvas text-xs text-ink-soft ring-2 ring-white">
              +{collaborators.length - 4}
            </span>
          )}
        </div>

        <IconButton label="Commentaires" active={panel === 'comments'} onClick={() => setPanel(p => (p === 'comments' ? null : 'comments'))}>
          <MessageSquare size={18} />
        </IconButton>
        <IconButton label="Historique des versions" active={panel === 'history'} onClick={() => setPanel(p => (p === 'history' ? null : 'history'))}>
          <History size={18} />
        </IconButton>
        <NotificationBell onOpenDocument={id => navigate({ name: 'document', docId: id })} />

        {role === 'OWNER' && (
          <Button variant="primary" size="sm" icon={<Users size={15} />} onClick={() => setDialog('share')} className="ml-1 h-8 rounded-full px-4">
            Partager
          </Button>
        )}

        <Menu
          align="right"
          trigger={({ toggle, open }) => (
            <IconButton label="Plus d'actions" active={open} onClick={toggle}><MoreHorizontal size={18} /></IconButton>
          )}
        >
          {close => (
            <>
              <MenuLabel>Télécharger</MenuLabel>
              <MenuItem icon={<Download size={14} />} onClick={() => { close(); exportDocument('pdf') }}>Document PDF (.pdf)</MenuItem>
              <MenuItem icon={<Download size={14} />} onClick={() => { close(); exportDocument('html') }}>Page web (.html)</MenuItem>
              <MenuItem icon={<Download size={14} />} onClick={() => { close(); exportDocument('md') }}>Markdown (.md)</MenuItem>
              <MenuSeparator />
              <MenuItem icon={<Link2 size={14} />} onClick={() => { close(); navigator.clipboard?.writeText(documentUrl(docId)) }}>Copier le lien</MenuItem>
              {role === 'OWNER' && (
                <MenuItem danger icon={<Trash2 size={14} />} onClick={() => { close(); deleteDocument() }}>Supprimer</MenuItem>
              )}
            </>
          )}
        </Menu>
      </header>

      {/* ─── Barre de mise en forme ─── */}
      {canEdit && editor && (
        <div className="flex shrink-0 justify-center border-b border-line bg-white px-3 py-1.5">
          <FormatToolbar editor={editor} />
        </div>
      )}

      <div className="flex min-h-0 flex-1">
        {/* ─── Page ─── */}
        <div className="relative flex-1 overflow-y-auto bg-canvas">
          <div className="mx-auto my-6 min-h-[1056px] w-full max-w-[816px] bg-white px-6 py-12 shadow-page sm:my-8 sm:px-[72px] sm:py-16">
            {doc ? (
              <>
                <textarea
                  value={title}
                  onChange={e => changeTitle(e.target.value.replace(/\n/g, ''))}
                  onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); editor?.commands.focus('start') } }}
                  readOnly={!canEdit}
                  placeholder="Sans titre"
                  rows={1}
                  aria-label="Titre du document"
                  className="mb-4 w-full resize-none overflow-hidden bg-transparent text-[40px] font-bold leading-tight text-ink outline-none placeholder:text-line-strong [field-sizing:content]"
                />
                <EditorContent editor={editor} />
              </>
            ) : (
              <div className="space-y-4">
                <div className="h-10 w-2/3 animate-pulse rounded bg-canvas" />
                {[100, 95, 90, 60].map(w => <div key={w} className="h-4 animate-pulse rounded bg-canvas" style={{ width: `${w}%` }} />)}
              </div>
            )}
          </div>
          {editor && (
            <div className="pointer-events-none sticky bottom-3 ml-3 inline-block rounded-md bg-white/90 px-2 py-1 text-xs text-ink-muted shadow-sm">
              {words} mot{words > 1 ? 's' : ''}
            </div>
          )}
        </div>

        {panel === 'comments' && (
          <CommentsPanel
            comments={comments}
            currentUserId={user?.id}
            canComment={canComment}
            canResolveAll={canEdit}
            canDeleteAll={role === 'OWNER'}
            onPost={postComment}
            onResolve={async id => { await api.patch(`/api/documents/${docId}/comments/${id}/resolve`); await loadComments() }}
            onDelete={async id => { await api.delete(`/api/documents/${docId}/comments/${id}`); await loadComments() }}
            onClose={() => setPanel(null)}
          />
        )}
        {panel === 'history' && (
          <HistoryPanel
            snapshots={snapshots}
            canSave={canEdit}
            onSave={saveSnapshot}
            onView={setPreviewSnapshot}
            onCompare={() => setDialog('diff')}
            onClose={() => setPanel(null)}
          />
        )}
      </div>

      {dialog === 'share' && doc && (
        <ShareDialog docId={docId} docTitle={title} workspaceId={doc.workspaceId} onClose={() => setDialog(null)} />
      )}
      {dialog === 'diff' && <SnapshotDiffDialog docId={docId} snapshots={snapshots} onClose={() => setDialog(null)} />}
      {previewSnapshot && (
        <SnapshotPreviewDialog
          docId={docId}
          snapshot={previewSnapshot}
          canRestore={canEdit}
          onRestore={html => editor?.commands.setContent(html)}
          onClose={() => setPreviewSnapshot(null)}
        />
      )}
    </div>
  )
}

function SaveIndicator({ status, saveStatus, canEdit, updatedAt }: {
  status: string; saveStatus: SaveStatus; canEdit: boolean; updatedAt?: string
}) {
  const base = 'hidden shrink-0 items-center gap-1.5 text-xs md:flex'
  if (status === 'disconnected') {
    return <span className={`${base} text-amber-600`}><CloudOff size={14} /> Hors ligne — modifications conservées localement</span>
  }
  if (status === 'connecting') {
    return <span className={`${base} text-ink-muted`}><Loader2 size={14} className="animate-spin" /> Connexion…</span>
  }
  if (!canEdit) {
    return updatedAt ? <span className={`${base} text-ink-muted`}>Modifié {relativeTime(updatedAt)}</span> : null
  }
  const label = {
    saved: 'Toutes les modifications ont été enregistrées',
    saving: 'Enregistrement…',
    unsaved: 'Modifications non enregistrées',
    error: 'Échec de l\'enregistrement — nouvel essai à la prochaine modification',
  }[saveStatus]
  return <span className={`${base} ${saveStatus === 'error' ? 'text-red-600' : 'text-ink-muted'}`}>{label}</span>
}
