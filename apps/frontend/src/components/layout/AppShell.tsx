import { useEffect, useState, type ReactNode } from 'react'
import { safeStorage } from '../../lib/format'
import { navigate, type Route } from '../../lib/router'
import { useWorkspaceStore } from '../../store/workspaceStore'
import SearchDialog from '../dialogs/SearchDialog'
import Sidebar from './Sidebar'

const SIDEBAR_KEY = 'collab:sidebar-open'
const storage = safeStorage()

interface Props {
  route: Route
  children: (shell: { sidebarOpen: boolean; openSidebar: () => void }) => ReactNode
}

// Structure commune : barre latérale (façon Notion) + zone de contenu
export default function AppShell({ route, children }: Props) {
  const [sidebarOpen, setSidebarOpen] = useState(() =>
    storage.get(SIDEBAR_KEY) !== 'false' && window.innerWidth >= 768
  )
  const [searchOpen, setSearchOpen] = useState(false)

  useEffect(() => {
    useWorkspaceStore.getState().loadWorkspaces().catch(() => { /* géré par le store */ })
  }, [])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        setSearchOpen(o => !o)
      }
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [])

  const setOpen = (open: boolean) => {
    setSidebarOpen(open)
    storage.set(SIDEBAR_KEY, String(open))
  }

  return (
    <div className="flex h-screen overflow-hidden bg-white font-sans text-ink antialiased">
      {sidebarOpen && (
        <>
          {/* Sur mobile, la barre latérale passe en surimpression */}
          <div className="fixed inset-0 z-30 bg-black/30 md:hidden" onClick={() => setOpen(false)} />
          <div className="fixed inset-y-0 left-0 z-40 md:static md:z-auto">
            <Sidebar route={route} onCollapse={() => setOpen(false)} onOpenSearch={() => setSearchOpen(true)} />
          </div>
        </>
      )}
      <main className="flex min-w-0 flex-1 flex-col">
        {children({ sidebarOpen, openSidebar: () => setOpen(true) })}
      </main>
      {searchOpen && (
        <SearchDialog
          onClose={() => setSearchOpen(false)}
          onOpenDocument={docId => navigate({ name: 'document', docId })}
        />
      )}
    </div>
  )
}
