import { useState } from 'react'
import { FileText, Menu as MenuIcon, Plus, Search } from 'lucide-react'
import { relativeTime } from '../lib/format'
import { navigate } from '../lib/router'
import { useAuthStore } from '../store/authStore'
import { useActiveWorkspace, useWorkspaceStore } from '../store/workspaceStore'
import NotificationBell from '../components/layout/NotificationBell'
import PromptDialog from '../components/dialogs/PromptDialog'
import { Button, IconButton } from '../components/ui/Button'

interface Props {
  sidebarOpen: boolean
  openSidebar: () => void
}

function greeting(): string {
  const hour = new Date().getHours()
  if (hour < 5 || hour >= 18) return 'Bonsoir'
  return 'Bonjour'
}

// Accueil : « Démarrer un nouveau document » et documents récents (façon Google Docs)
export default function HomePage({ sidebarOpen, openSidebar }: Props) {
  const user = useAuthStore(s => s.user)
  const workspace = useActiveWorkspace()
  const workspaces = useWorkspaceStore(s => s.workspaces)
  const documents = useWorkspaceStore(s => s.documents)
  const loading = useWorkspaceStore(s => s.loadingDocuments)
  const error = useWorkspaceStore(s => s.error)
  const [creatingWorkspace, setCreatingWorkspace] = useState(false)
  const [query, setQuery] = useState('')

  const filtered = documents.filter(d => d.title.toLowerCase().includes(query.trim().toLowerCase()))

  const newDocument = async () => {
    const doc = await useWorkspaceStore.getState().createDocument()
    navigate({ name: 'document', docId: doc.id })
  }

  return (
    <div className="flex h-full flex-col">
      <header className="flex h-12 shrink-0 items-center justify-between gap-2 px-3">
        <div className="flex items-center gap-1">
          {!sidebarOpen && (
            <IconButton label="Afficher la barre latérale" onClick={openSidebar}><MenuIcon size={18} /></IconButton>
          )}
          <span className="px-1 text-sm text-ink-soft">{workspace?.name ?? 'Accueil'}</span>
        </div>
        <NotificationBell onOpenDocument={docId => navigate({ name: 'document', docId })} />
      </header>

      <div className="flex-1 overflow-y-auto">
        {workspaces.length === 0 && !loading ? (
          <div className="mx-auto flex max-w-md flex-col items-center px-6 py-24 text-center">
            <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-accent-soft text-accent">
              <FileText size={28} />
            </div>
            <h1 className="text-2xl font-semibold text-ink">Bienvenue{user ? `, ${user.email.split('@')[0]}` : ''}</h1>
            <p className="mt-2 text-sm text-ink-soft">Créez un workspace pour commencer à écrire et collaborer avec votre équipe.</p>
            <Button variant="primary" className="mt-6" icon={<Plus size={16} />} onClick={() => setCreatingWorkspace(true)}>
              Créer un workspace
            </Button>
          </div>
        ) : (
          <>
            {/* Bandeau « Démarrer un nouveau document » */}
            <section className="bg-canvas">
              <div className="mx-auto max-w-5xl px-6 py-8">
                <h1 className="mb-1 text-2xl font-semibold text-ink">
                  {greeting()}{user ? `, ${user.email.split('@')[0]}` : ''}
                </h1>
                <p className="mb-5 text-sm text-ink-soft">Démarrer un nouveau document</p>
                <button onClick={newDocument} className="group w-36 text-left cursor-pointer" disabled={!workspace}>
                  <div className="flex aspect-[3/4] items-center justify-center rounded-md border border-line-strong bg-surface transition-colors group-hover:border-accent">
                    <Plus size={44} strokeWidth={1.25} className="text-accent" />
                  </div>
                  <div className="mt-2 text-sm font-medium text-ink">Document vierge</div>
                </button>
              </div>
            </section>

            {/* Documents récents */}
            <section className="mx-auto max-w-5xl px-6 py-8">
              <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                <h2 className="text-base font-medium text-ink">Documents récents</h2>
                <label className="flex h-9 w-full max-w-xs items-center gap-2 rounded-md border border-control px-3 focus-within:border-accent focus-within:ring-2 focus-within:ring-accent/30 sm:w-64">
                  <Search size={15} className="text-ink-muted" />
                  <input
                    value={query}
                    onChange={e => setQuery(e.target.value)}
                    placeholder="Filtrer par titre"
                    className="flex-1 bg-transparent text-sm outline-none"
                  />
                </label>
              </div>

              {error && <p className="mb-4 rounded-md bg-danger-soft px-3 py-2 text-sm text-danger">{error}</p>}

              {loading && documents.length === 0 ? (
                <div className="grid grid-cols-2 gap-5 sm:grid-cols-3 lg:grid-cols-5">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <div key={i} className="aspect-[3/4] animate-pulse rounded-md bg-canvas" />
                  ))}
                </div>
              ) : filtered.length === 0 ? (
                <p className="py-12 text-center text-sm text-ink-muted">
                  {query ? 'Aucun document ne correspond' : 'Aucun document — créez-en un ci-dessus'}
                </p>
              ) : (
                <div className="grid grid-cols-2 gap-5 sm:grid-cols-3 lg:grid-cols-5">
                  {filtered.map(doc => (
                    <button
                      key={doc.id}
                      onClick={() => navigate({ name: 'document', docId: doc.id })}
                      className="group overflow-hidden rounded-md border border-line-strong text-left transition-colors hover:border-accent cursor-pointer"
                    >
                      {/* Vignette stylisée de la page */}
                      <div className="aspect-[4/3] border-b border-line bg-surface px-4 pt-4">
                        <div className="mb-2 h-2 w-3/4 rounded bg-line-strong" />
                        {[90, 100, 80, 95, 60].map((w, i) => (
                          <div key={i} className="mb-1.5 h-1.5 rounded bg-line" style={{ width: `${w}%` }} />
                        ))}
                      </div>
                      <div className="px-3 py-2.5">
                        <div className="truncate text-sm font-medium text-ink">{doc.title || 'Sans titre'}</div>
                        <div className="mt-0.5 flex items-center gap-1.5 text-xs text-ink-muted">
                          <FileText size={12} className="text-accent" />
                          Modifié {relativeTime(doc.updatedAt)}
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </section>
          </>
        )}
      </div>

      {creatingWorkspace && (
        <PromptDialog
          title="Nouveau workspace"
          label="Nom du workspace"
          placeholder="ex. Équipe Produit"
          confirmLabel="Créer"
          onConfirm={async name => { await useWorkspaceStore.getState().createWorkspace(name) }}
          onClose={() => setCreatingWorkspace(false)}
        />
      )}
    </div>
  )
}
