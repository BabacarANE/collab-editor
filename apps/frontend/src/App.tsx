import { useEffect } from 'react'
import { useAuthStore } from './store/authStore'
import { useWorkspaceStore } from './store/workspaceStore'
import { useRoute } from './lib/router'
import AppShell from './components/layout/AppShell'
import LoginPage from './pages/LoginPage'
import HomePage from './pages/HomePage'
import EditorPage from './pages/EditorPage'

export default function App() {
  const user = useAuthStore(s => s.user)
  const route = useRoute()

  // À la déconnexion, on oublie les données du compte précédent
  useEffect(() => {
    if (!user) useWorkspaceStore.getState().reset()
  }, [user])

  if (!user) return <LoginPage />

  return (
    <AppShell route={route}>
      {({ sidebarOpen, openSidebar }) =>
        route.name === 'document' ? (
          // key : un nouveau document = nouvelle session Yjs et nouvel éditeur
          <EditorPage key={route.docId} docId={route.docId} sidebarOpen={sidebarOpen} openSidebar={openSidebar} />
        ) : (
          <HomePage sidebarOpen={sidebarOpen} openSidebar={openSidebar} />
        )
      }
    </AppShell>
  )
}
