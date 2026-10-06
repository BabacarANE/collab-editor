import { useState } from 'react'
import {
  Check, ChevronsLeft, ChevronsUpDown, FileText, Home, Link2, LogOut, MoreHorizontal,
  Plus, Search, Trash2, Upload, Users
} from 'lucide-react'
import { documentUrl, navigate, type Route } from '../../lib/router'
import { useAuthStore } from '../../store/authStore'
import { useActiveWorkspace, useWorkspaceStore } from '../../store/workspaceStore'
import type { DocumentSummary } from '../../types'
import { ThemeToggle } from '../ui/ThemeToggle'
import { Avatar } from '../ui/Avatar'
import { Menu, MenuItem, MenuLabel, MenuSeparator } from '../ui/Menu'
import ImportDialog from '../dialogs/ImportDialog'
import MembersDialog from '../dialogs/MembersDialog'
import PromptDialog from '../dialogs/PromptDialog'

interface Props {
  route: Route
  onCollapse: () => void
  onOpenSearch: () => void
}

type Dialog = 'members' | 'import' | 'workspace' | null

function NavItem({ icon, label, onClick, active, hint }: {
  icon: React.ReactNode; label: string; onClick: () => void; active?: boolean; hint?: string
}) {
  return (
    <button
      onClick={onClick}
      className={`flex h-8 w-full items-center gap-2.5 rounded-md px-2 text-left text-sm cursor-pointer ${
        active ? 'bg-accent-soft font-medium text-accent' : 'text-ink-soft hover:bg-hover hover:text-ink'
      }`}
    >
      <span className="flex w-5 justify-center">{icon}</span>
      <span className="flex-1 truncate">{label}</span>
      {hint && <span className="text-xs text-ink-muted">{hint}</span>}
    </button>
  )
}

export default function Sidebar({ route, onCollapse, onOpenSearch }: Props) {
  const user = useAuthStore(s => s.user)
  const logout = useAuthStore(s => s.logout)
  const workspaces = useWorkspaceStore(s => s.workspaces)
  const documents = useWorkspaceStore(s => s.documents)
  const loading = useWorkspaceStore(s => s.loadingDocuments)
  const { selectWorkspace, createWorkspace, createDocument, deleteDocument, addDocument } = useWorkspaceStore.getState()
  const active = useActiveWorkspace()
  const [dialog, setDialog] = useState<Dialog>(null)

  const activeDocId = route.name === 'document' ? route.docId : null

  const newPage = async () => {
    const doc = await createDocument()
    navigate({ name: 'document', docId: doc.id })
  }

  const remove = async (doc: DocumentSummary) => {
    if (!confirm(`Supprimer « ${doc.title} » ?`)) return
    await deleteDocument(doc.id)
    if (activeDocId === doc.id) navigate({ name: 'home' })
  }

  return (
    <aside className="flex h-full w-64 shrink-0 flex-col border-r border-line bg-sidebar">
      {/* Sélecteur de workspace */}
      <div className="flex items-center gap-1 p-2">
        <div className="min-w-0 flex-1">
          <Menu
            width="w-64"
            trigger={({ toggle }) => (
              <button onClick={toggle} className="flex h-10 w-full items-center gap-2 rounded-md px-2 hover:bg-hover cursor-pointer">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded bg-ink text-xs font-semibold text-surface">
                  {(active?.name ?? '?').charAt(0).toUpperCase()}
                </span>
                <span className="flex-1 truncate text-left text-sm font-semibold text-ink">
                  {active?.name ?? 'Aucun workspace'}
                </span>
                <ChevronsUpDown size={14} className="text-ink-muted" />
              </button>
            )}
          >
            {close => (
              <>
                <MenuLabel>{user?.email}</MenuLabel>
                {workspaces.map(w => (
                  <MenuItem
                    key={w.id}
                    icon={w.id === active?.id ? <Check size={14} /> : <span />}
                    onClick={() => { close(); selectWorkspace(w.id); navigate({ name: 'home' }) }}
                    hint={w.role === 'ADMIN' ? 'Admin' : undefined}
                  >
                    {w.name}
                  </MenuItem>
                ))}
                <MenuSeparator />
                <MenuItem icon={<Plus size={14} />} onClick={() => { close(); setDialog('workspace') }}>
                  Nouveau workspace
                </MenuItem>
                <MenuItem icon={<LogOut size={14} />} onClick={() => { close(); logout() }}>
                  Se déconnecter
                </MenuItem>
              </>
            )}
          </Menu>
        </div>
        <button onClick={onCollapse} title="Masquer la barre latérale" className="rounded-md p-1.5 text-ink-muted hover:bg-hover hover:text-ink cursor-pointer">
          <ChevronsLeft size={16} />
        </button>
      </div>

      {/* Navigation principale */}
      <nav className="space-y-0.5 px-2">
        <NavItem icon={<Search size={16} />} label="Rechercher" hint="Ctrl K" onClick={onOpenSearch} />
        <NavItem icon={<Home size={16} />} label="Accueil" active={route.name === 'home'} onClick={() => navigate({ name: 'home' })} />
        {active && <NavItem icon={<Users size={16} />} label="Membres" onClick={() => setDialog('members')} />}
        {active && <NavItem icon={<Upload size={16} />} label="Importer" onClick={() => setDialog('import')} />}
      </nav>

      {/* Pages du workspace */}
      <div className="mt-5 flex min-h-0 flex-1 flex-col">
        <div className="group flex items-center justify-between px-4 pb-1">
          <span className="text-xs font-medium text-ink-muted">Pages</span>
          {active && (
            <button onClick={newPage} title="Nouvelle page" className="rounded p-0.5 text-ink-muted opacity-0 hover:bg-hover hover:text-ink group-hover:opacity-100 cursor-pointer">
              <Plus size={14} />
            </button>
          )}
        </div>
        <div className="min-h-0 flex-1 space-y-0.5 overflow-y-auto px-2 pb-2">
          {loading && documents.length === 0 && <div className="px-2 py-1 text-sm text-ink-muted">Chargement…</div>}
          {!loading && active && documents.length === 0 && (
            <div className="px-2 py-1 text-sm text-ink-muted">Aucune page</div>
          )}
          {documents.map(doc => (
            <div
              key={doc.id}
              className={`group flex h-8 items-center rounded-md pr-1 ${activeDocId === doc.id ? 'bg-accent-soft' : 'hover:bg-hover'}`}
            >
              <button
                onClick={() => navigate({ name: 'document', docId: doc.id })}
                className={`flex min-w-0 flex-1 items-center gap-2.5 px-2 text-left text-sm cursor-pointer ${
                  activeDocId === doc.id ? 'font-medium text-ink' : 'text-ink-soft'
                }`}
              >
                <FileText size={16} className="shrink-0 text-ink-muted" />
                <span className="truncate">{doc.title || 'Sans titre'}</span>
              </button>
              <Menu
                align="right"
                width="w-48"
                trigger={({ toggle }) => (
                  <button onClick={toggle} title="Plus d'actions" className="rounded p-0.5 text-ink-muted opacity-0 hover:bg-line hover:text-ink group-hover:opacity-100 cursor-pointer">
                    <MoreHorizontal size={14} />
                  </button>
                )}
              >
                {close => (
                  <>
                    <MenuItem icon={<Link2 size={14} />} onClick={() => { close(); navigator.clipboard?.writeText(documentUrl(doc.id)) }}>
                      Copier le lien
                    </MenuItem>
                    {doc.ownerId === user?.id && (
                      <MenuItem danger icon={<Trash2 size={14} />} onClick={() => { close(); remove(doc) }}>
                        Supprimer
                      </MenuItem>
                    )}
                  </>
                )}
              </Menu>
            </div>
          ))}
        </div>
      </div>

      {/* Bas de la barre */}
      <div className="border-t border-line p-2">
        {active && (
          <button onClick={newPage} className="flex h-8 w-full items-center gap-2.5 rounded-md px-2 text-sm text-ink-soft hover:bg-hover hover:text-ink cursor-pointer">
            <Plus size={16} className="w-5" /> Nouvelle page
          </button>
        )}
        {user && (
          <div className="mt-1 flex items-center gap-2.5 px-2 py-1.5">
            <Avatar email={user.email} id={user.id} size={22} />
            <span className="min-w-0 flex-1 truncate text-xs text-ink-soft">{user.email}</span>
            <ThemeToggle />
          </div>
        )}
      </div>

      {dialog === 'members' && active && <MembersDialog workspace={active} onClose={() => setDialog(null)} />}
      {dialog === 'import' && active && (
        <ImportDialog
          workspaceId={active.id}
          onClose={() => setDialog(null)}
          onImported={doc => { addDocument(doc); navigate({ name: 'document', docId: doc.id }) }}
        />
      )}
      {dialog === 'workspace' && (
        <PromptDialog
          title="Nouveau workspace"
          label="Nom du workspace"
          placeholder="ex. Équipe Produit"
          confirmLabel="Créer"
          onConfirm={async name => { await createWorkspace(name); navigate({ name: 'home' }) }}
          onClose={() => setDialog(null)}
        />
      )}
    </aside>
  )
}
