import { useState } from 'react'
import { api } from '../api/client'
import { useAuthStore } from '../store/authStore'

export default function LoginPage({ onLogin }: { onLogin: () => void }) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [isRegister, setIsRegister] = useState(false)
  const setAuth = useAuthStore((s) => s.setAuth)

  const handleSubmit = async () => {
    try {
      const endpoint = isRegister ? '/api/auth/register' : '/api/auth/login'
      const res = await api.post(endpoint, { email, password })
      setAuth(res.data.user, res.data.accessToken, res.data.refreshToken)
      onLogin()
    } catch (e: any) {
      setError(e.response?.data?.error ?? 'Erreur')
    }
  }

  return (
    <div style={{ maxWidth: 400, margin: '100px auto', padding: 24, fontFamily: 'sans-serif' }}>
      <h2>{isRegister ? 'Inscription' : 'Connexion'}</h2>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <input
          placeholder="Email"
          value={email}
          onChange={e => setEmail(e.target.value)}
          style={{ padding: 8, fontSize: 16 }}
        />
        <input
          placeholder="Mot de passe"
          type="password"
          value={password}
          onChange={e => setPassword(e.target.value)}
          style={{ padding: 8, fontSize: 16 }}
        />
        {error && <p style={{ color: 'red' }}>{error}</p>}
        <button onClick={handleSubmit} style={{ padding: 10, fontSize: 16, cursor: 'pointer' }}>
          {isRegister ? "S'inscrire" : 'Se connecter'}
        </button>
        <button onClick={() => setIsRegister(!isRegister)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'blue' }}>
          {isRegister ? 'Déjà un compte ? Se connecter' : "Pas de compte ? S'inscrire"}
        </button>
      </div>
    </div>
  )
}