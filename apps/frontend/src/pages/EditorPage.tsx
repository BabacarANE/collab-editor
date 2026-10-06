import { useEffect, useState } from 'react'
import { EditorContent, useEditor, useEditorState } from '@tiptap/react'
import { FileText } from 'lucide-react'
import { documentsApi, type ExportFormat } from '../api/endpoints'
import { useAutosave } from '../hooks/useAutosave'
import { useCollaboration } from '../hooks/useCollaboration'
import { useComments } from '../hooks/useComments'
import { useDocument } from '../hooks/useDocument'
import { useDocumentTitle } from '../hooks/useDocumentTitle'
import { useSnapshots } from '../hooks/useSnapshots'
import { downloadBlob } from '../lib/download'
import { colorFor } from '../lib/format'
import { createMemberSearch } from '../lib/memberSearch'
import { capabilitiesFor } from '../lib/permissions'
import { documentUrl, navigate } from '../lib/router'
import { useAuthStore } from '../store/authStore'
import { useWorkspaceStore } from '../store/workspaceStore'
import type { Snapshot } from '../types'
import CommentsPanel from '../components/editor/CommentsPanel'
import DocumentHeader, { type Panel } from '../components/editor/DocumentHeader'
import FormatToolbar from '../components/editor/FormatToolbar'
import HistoryPanel from '../components/editor/HistoryPanel'
import SaveIndicator from '../components/editor/SaveIndicator'
import { buildExtensions } from '../components/editor/extensions'
import ShareDialog from '../components/dialogs/ShareDialog'
import SnapshotDiffDialog from '../components/dialogs/SnapshotDiffDialog'
import SnapshotPreviewDialog from '../components/dialogs/SnapshotPreviewDialog'
import { Button } from '../components/ui/Button'

interface Props {
  docId: string
  sidebarOpen: boolean
  openSidebar: () => void
}

// Assemble l'éditeur : chaque responsabilité vit dans son hook ou composant
export default function EditorPage({ docId, sidebarOpen, openSidebar }: Props) {
  const user = useAuthStore(s => s.user)
  const { doc, role, error } = useDocument(docId)
  const { ydoc, provider, status: connection, synced, collaborators } = useCollaboration(docId)
  const capabilities = capabilitiesFor(role)
  const { canEdit } = capabilities

  const [panel, setPanel] = useState<Panel>(null)
  const [dialog, setDialog] = useState<'share' | 'diff' | null>(null)
  const [previewSnapshot, setPreviewSnapshot] = useState<Snapshot | null>(null)
  const [searchMembers] = useState(() => createMemberSearch(() => useWorkspaceStore.getState().activeWorkspaceId))

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

  const { title, changeTitle, failed: titleFailed } = useDocumentTitle(docId, ydoc, doc?.title)
  const saveStatus = useAutosave(editor, docId, canEdit, synced)
  const comments = useComments(docId, panel === 'comments')
  const history = useSnapshots(docId, panel === 'history')
  const words = useEditorState({ editor, selector: ({ editor: e }) => e?.storage.characterCount?.words?.() ?? 0 })

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

  const exportDocument = async (format: ExportFormat) => {
    downloadBlob(await documentsApi.export(docId, format), `${title || 'document'}.${format}`)
  }

  const deleteDocument = async () => {
    if (!confirm(`Supprimer « ${title} » ? Cette action est irréversible.`)) return
    await useWorkspaceStore.getState().deleteDocument(docId)
    navigate({ name: 'home' })
  }

  if (error) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 px-6 text-center">
        <FileText size={40} className="text-ink-muted" />
        <h1 className="text-lg font-semibold text-ink">{error}</h1>
        <p className="text-sm text-ink-soft">Vérifiez le lien ou demandez l'accès au propriétaire du document.</p>
        <Button onClick={() => navigate({ name: 'home' })}>Retour à l'accueil</Button>
      </div>
    )
  }

  return (
    <div className="flex h-full flex-col">
      <DocumentHeader
        title={title}
        role={role}
        capabilities={capabilities}
        collaborators={collaborators}
        status={
          <SaveIndicator
            connection={connection}
            saveStatus={titleFailed ? 'error' : saveStatus}
            canEdit={canEdit}
            updatedAt={doc?.updatedAt}
          />
        }
        panel={panel}
        sidebarOpen={sidebarOpen}
        onOpenSidebar={openSidebar}
        onTogglePanel={p => setPanel(current => (current === p ? null : p))}
        onShare={() => setDialog('share')}
        onExport={exportDocument}
        onCopyLink={() => navigator.clipboard?.writeText(documentUrl(docId))}
        onDelete={deleteDocument}
      />

      {canEdit && editor && (
        <div className="flex shrink-0 justify-center border-b border-line bg-surface px-3 py-1.5">
          <FormatToolbar editor={editor} />
        </div>
      )}

      <div className="flex min-h-0 flex-1">
        {/* Page « papier » centrée */}
        <div className="relative flex-1 overflow-y-auto bg-canvas">
          <div className="mx-auto my-6 min-h-[1056px] w-full max-w-[816px] bg-surface px-6 py-12 shadow-page sm:my-8 sm:px-[72px] sm:py-16">
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
                  className="mb-4 w-full resize-none overflow-hidden bg-transparent text-[40px] font-bold leading-tight text-ink outline-none placeholder:text-ink-muted [field-sizing:content]"
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
            <div className="pointer-events-none sticky bottom-3 ml-3 inline-block rounded-md bg-surface/90 px-2 py-1 text-xs text-ink-muted shadow-sm">
              {words} mot{words > 1 ? 's' : ''}
            </div>
          )}
        </div>

        {panel === 'comments' && (
          <CommentsPanel
            comments={comments.comments}
            currentUserId={user?.id}
            canComment={capabilities.canComment}
            canResolveAll={capabilities.canResolveAll}
            canDeleteAll={capabilities.canManage}
            onPost={comments.post}
            onResolve={comments.resolve}
            onDelete={comments.remove}
            onClose={() => setPanel(null)}
          />
        )}
        {panel === 'history' && (
          <HistoryPanel
            snapshots={history.snapshots}
            canSave={canEdit}
            onSave={name => history.save(name, editor?.getHTML() ?? '')}
            onView={setPreviewSnapshot}
            onCompare={() => setDialog('diff')}
            onClose={() => setPanel(null)}
          />
        )}
      </div>

      {dialog === 'share' && doc && (
        <ShareDialog docId={docId} docTitle={title} workspaceId={doc.workspaceId} onClose={() => setDialog(null)} />
      )}
      {dialog === 'diff' && <SnapshotDiffDialog docId={docId} snapshots={history.snapshots} onClose={() => setDialog(null)} />}
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
