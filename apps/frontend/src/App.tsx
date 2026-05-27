import { useState } from 'react'
import { useAuthStore } from './store/authStore'
import LoginPage from './pages/LoginPage'
import EditorPage from './pages/EditorPage'

export default function App() {
  const user = useAuthStore((s) => s.user)
  const [loggedIn, setLoggedIn] = useState(!!user)

  if (!loggedIn) {
    return <LoginPage onLogin={() => setLoggedIn(true)} />
  }

  return <EditorPage />
}