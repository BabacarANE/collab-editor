import { useState } from 'react'
import { useAuthStore } from './store/authStore'
import LoginPage from './pages/LoginPage'
import DashboardPage from './pages/DashboardPage'
import EditorPage from './pages/EditorPage'

type View = 'login' | 'dashboard' | 'editor'

export default function App() {
  const user = useAuthStore((s) => s.user)
  const [view, setView] = useState<View>(user ? 'dashboard' : 'login')
  const [currentDocId, setCurrentDocId] = useState<string | null>(null)

  if (view === 'login') {
    return <LoginPage onLogin={() => setView('dashboard')} />
  }

  if (view === 'editor' && currentDocId) {
    return (
      <EditorPage
        docId={currentDocId}
        onBack={() => setView('dashboard')}
      />
    )
  }

  return (
    <DashboardPage
      onOpenDocument={(docId) => {
        setCurrentDocId(docId)
        setView('editor')
      }}
    />
  )
}