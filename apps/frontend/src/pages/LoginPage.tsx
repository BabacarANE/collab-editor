import { useState } from 'react'
import { FileText } from 'lucide-react'
import { authApi } from '../api/endpoints'
import { apiError } from '../lib/format'
import { useAuthStore } from '../store/authStore'
import { Button } from '../components/ui/Button'

const MIN_PASSWORD_LENGTH = 8

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [isRegister, setIsRegister] = useState(false)
  const [loading, setLoading] = useState(false)
  const setAuth = useAuthStore(s => s.setAuth)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!email || !password) return
    if (isRegister && password.length < MIN_PASSWORD_LENGTH) {
      setError(`Le mot de passe doit contenir au moins ${MIN_PASSWORD_LENGTH} caractères`)
      return
    }
    setLoading(true)
    setError('')
    try {
      const session = await (isRegister ? authApi.register : authApi.login)(email, password)
      setAuth(session.user, session.accessToken, session.refreshToken)
    } catch (err) {
      setError(apiError(err, 'Connexion impossible'))
    } finally {
      setLoading(false)
    }
  }

  const input = 'h-10 w-full rounded-md border border-line-strong px-3 text-sm text-ink outline-none transition-shadow focus:border-accent focus:ring-2 focus:ring-accent-soft'

  return (
    <div className="flex min-h-screen items-center justify-center bg-white px-4 font-sans antialiased">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-accent text-white shadow-sm">
            <FileText size={24} />
          </div>
          <h1 className="text-2xl font-semibold text-ink">
            {isRegister ? 'Créer un compte' : 'Bon retour parmi nous'}
          </h1>
          <p className="mt-1.5 text-sm text-ink-soft">
            {isRegister ? 'Écrivez et collaborez en temps réel' : 'Connectez-vous à Collab Editor'}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="email" className="mb-1.5 block text-sm font-medium text-ink-soft">Adresse e-mail</label>
            <input id="email" type="email" autoComplete="email" placeholder="vous@exemple.com" value={email} onChange={e => setEmail(e.target.value)} className={input} />
          </div>
          <div>
            <label htmlFor="password" className="mb-1.5 block text-sm font-medium text-ink-soft">Mot de passe</label>
            <input
              id="password"
              type="password"
              autoComplete={isRegister ? 'new-password' : 'current-password'}
              placeholder={isRegister ? `${MIN_PASSWORD_LENGTH} caractères minimum` : '••••••••'}
              value={password}
              onChange={e => setPassword(e.target.value)}
              className={input}
            />
          </div>

          {error && <p role="alert" className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>}

          <Button type="submit" variant="primary" className="w-full" disabled={loading || !email || !password}>
            {loading ? 'Un instant…' : isRegister ? 'Créer mon compte' : 'Continuer'}
          </Button>
        </form>

        <p className="mt-6 text-center text-sm text-ink-soft">
          {isRegister ? 'Déjà un compte ?' : 'Pas encore de compte ?'}{' '}
          <button
            type="button"
            onClick={() => { setIsRegister(!isRegister); setError('') }}
            className="font-medium text-accent hover:underline cursor-pointer"
          >
            {isRegister ? 'Se connecter' : 'Créer un compte'}
          </button>
        </p>
      </div>
    </div>
  )
}
