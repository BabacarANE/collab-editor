import { useState } from 'react'
import { ArrowLeft, FileText, History, MessageSquare, Users } from 'lucide-react'
import { authApi } from '../api/endpoints'
import { apiError } from '../lib/format'
import { navigate } from '../lib/router'
import { useAuthStore } from '../store/authStore'
import { Button } from '../components/ui/Button'
import { ThemeToggle } from '../components/ui/ThemeToggle'

const MIN_PASSWORD_LENGTH = 8

export default function LoginPage({ initialRegister = false }: { initialRegister?: boolean }) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [isRegister, setIsRegister] = useState(initialRegister)
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
      navigate({ name: 'home' })
    } catch (err) {
      setError(apiError(err, 'Connexion impossible'))
    } finally {
      setLoading(false)
    }
  }

  const input = 'h-10 w-full rounded-md border border-control px-3 text-sm text-ink outline-none transition-shadow focus:border-accent focus:ring-2 focus:ring-accent/30'

  return (
    <div className="grid min-h-screen bg-surface font-sans text-ink antialiased lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
      {/* Panneau de présentation (desktop) */}
      <aside className="relative hidden flex-col justify-between overflow-hidden border-r border-line bg-canvas p-12 lg:flex">
        <div className="flex items-center gap-2.5">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-accent text-accent-ink"><FileText size={18} /></span>
          <span className="text-base font-semibold tracking-tight">Collab Editor</span>
        </div>

        <div className="max-w-md">
          <h2 className="text-balance text-4xl font-semibold leading-[1.1] tracking-tight">
            Écrivez ensemble, au même moment.
          </h2>
          <ul className="mt-8 space-y-4 text-[15px] text-ink-soft">
            <li className="flex gap-3"><Users size={18} className="mt-0.5 shrink-0 text-accent" /><span>Curseurs et présence de chaque collaborateur en direct.</span></li>
            <li className="flex gap-3"><MessageSquare size={18} className="mt-0.5 shrink-0 text-accent" /><span>Commentaires, mentions et notifications dans le document.</span></li>
            <li className="flex gap-3"><History size={18} className="mt-0.5 shrink-0 text-accent" /><span>Historique des versions, avec comparaison et restauration.</span></li>
          </ul>
        </div>

        {/* Page d'exemple : lignes de texte et deux curseurs, sans faux chrome de navigateur */}
        <figure aria-hidden="true" className="max-w-md rounded-xl border border-line bg-surface p-6 shadow-page">
          <div className="mb-4 h-3 w-2/3 rounded bg-ink/80" />
          <div className="space-y-2.5">
            <div className="h-2 w-full rounded bg-line-strong" />
            <div className="relative h-2 w-5/6 rounded bg-line-strong">
              <span className="absolute -right-1 -top-4 h-6 w-0.5" style={{ background: 'oklch(52% 0.19 25)' }}>
                <span className="absolute -top-0.5 left-0 whitespace-nowrap rounded-r rounded-tl px-1.5 text-[10px] font-semibold leading-4 text-white" style={{ background: 'oklch(52% 0.19 25)' }}>Inès</span>
              </span>
            </div>
            <div className="h-2 w-11/12 rounded bg-line-strong" />
            <div className="relative h-2 w-2/5 rounded bg-line-strong">
              <span className="absolute -right-1 -top-4 h-6 w-0.5" style={{ background: 'oklch(50% 0.17 265)' }}>
                <span className="absolute -top-0.5 left-0 whitespace-nowrap rounded-r rounded-tl px-1.5 text-[10px] font-semibold leading-4 text-white" style={{ background: 'oklch(50% 0.17 265)' }}>Malik</span>
              </span>
            </div>
          </div>
        </figure>
      </aside>

      {/* Formulaire */}
      <main className="relative flex items-center justify-center px-6 py-12">
        <ThemeToggle className="absolute right-4 top-4" />
        <div className="w-full max-w-sm">
          <div className="mb-8">
            <a href="#/" className="mb-6 inline-flex items-center gap-1.5 text-sm text-ink-soft hover:text-ink">
              <ArrowLeft size={14} /> Retour à l'accueil
            </a>
            <div className="mb-6 flex h-11 w-11 items-center justify-center rounded-xl bg-accent text-accent-ink lg:hidden">
              <FileText size={22} />
            </div>
            <h1 className="text-2xl font-semibold tracking-tight text-ink">
              {isRegister ? 'Créer un compte' : 'Bon retour parmi nous'}
            </h1>
            <p className="mt-1.5 text-sm text-ink-soft">
              {isRegister ? 'Écrivez et collaborez en temps réel' : 'Connectez-vous à Collab Editor'}
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="email" className="mb-1.5 block text-sm font-medium text-ink">Adresse e-mail</label>
              <input id="email" type="email" autoComplete="email" placeholder="vous@exemple.com" value={email} onChange={e => setEmail(e.target.value)} className={input} />
            </div>
            <div>
              <label htmlFor="password" className="mb-1.5 block text-sm font-medium text-ink">Mot de passe</label>
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

            {error && <p role="alert" className="rounded-md bg-danger-soft px-3 py-2 text-sm text-danger">{error}</p>}

            <Button type="submit" variant="primary" className="h-10 w-full" disabled={loading || !email || !password}>
              {loading ? 'Un instant…' : isRegister ? 'Créer mon compte' : 'Continuer'}
            </Button>
          </form>

          <p className="mt-6 text-sm text-ink-soft">
            {isRegister ? 'Déjà un compte ?' : 'Pas encore de compte ?'}{' '}
            <button
              type="button"
              onClick={() => { setIsRegister(!isRegister); setError('') }}
              className="font-medium text-accent underline-offset-2 hover:underline cursor-pointer"
            >
              {isRegister ? 'Se connecter' : 'Créer un compte'}
            </button>
          </p>
        </div>
      </main>
    </div>
  )
}
