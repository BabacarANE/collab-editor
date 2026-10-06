import type { CSSProperties, ReactNode } from 'react'
import { ArrowRight, Check, FileText, History, MessageSquare, Users } from 'lucide-react'
import { useReveal } from '../hooks/useReveal'
import { navigate } from '../lib/router'
import { Button } from '../components/ui/Button'
import { ThemeToggle } from '../components/ui/ThemeToggle'
import '../styles/landing.css'

const CARET_A = 'oklch(52% 0.19 25)'
const CARET_B = 'oklch(50% 0.17 265)'
const CARET_C = 'oklch(52% 0.14 150)'

const goRegister = () => navigate({ name: 'register' })
const goLogin = () => navigate({ name: 'login' })
const cssVar = (name: string, value: number) => ({ [name]: value }) as CSSProperties

function Wordmark({ compact = false }: { compact?: boolean }) {
  return (
    <span className="flex items-center gap-2">
      <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-accent text-accent-ink"><FileText size={16} /></span>
      {!compact && <span className="whitespace-nowrap text-[15px] font-semibold tracking-tight">Collab Editor</span>}
    </span>
  )
}

// N5 · pilule flottante : détachée des bords, surface pleine (pas de flou), ombre douce
function Nav() {
  const scrollToSteps = () => document.getElementById('fonctionnement')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  return (
    <div className="fixed inset-x-0 top-3 z-30 flex justify-center px-4 sm:top-4">
      <nav aria-label="Principale" className="flex items-center gap-1 rounded-full border border-line bg-surface p-1.5 pl-3 shadow-pop sm:gap-2 sm:pl-4">
        <a href="#/" aria-label="Collab Editor, accueil" className="mr-1 rounded-full sm:mr-2">
          <span className="sm:hidden"><Wordmark compact /></span>
          <span className="hidden sm:block"><Wordmark /></span>
        </a>
        <button onClick={scrollToSteps} className="hidden h-8 whitespace-nowrap rounded-full px-3 text-sm text-ink-soft hover:bg-hover hover:text-ink cursor-pointer md:block">Fonctionnement</button>
        <button onClick={goLogin} className="h-8 whitespace-nowrap rounded-full px-3 text-sm font-medium text-ink hover:bg-hover cursor-pointer">Connexion</button>
        <Button variant="primary" size="sm" className="h-8 whitespace-nowrap rounded-full px-3.5 sm:px-4" onClick={goRegister}>Créer un compte</Button>
      </nav>
    </div>
  )
}

function Avatar({ name, color, size = 24 }: { name: string; color: string; size?: number }) {
  return (
    <span
      className="inline-flex shrink-0 items-center justify-center rounded-full font-semibold text-white ring-2 ring-surface"
      style={{ width: size, height: size, background: color, fontSize: Math.round(size * 0.4) }}
    >
      {name.slice(0, 2).toUpperCase()}
    </span>
  )
}

function Caret({ name, color, className }: { name: string; color: string; className: string }) {
  return (
    <span aria-hidden="true" className={`absolute -right-1 -top-1 h-5 w-0.5 ${className}`} style={{ background: color }}>
      <span className="absolute -top-4 left-0 whitespace-nowrap rounded-r rounded-tl px-1.5 text-[10px] font-semibold leading-4 text-white" style={{ background: color }}>{name}</span>
    </span>
  )
}

// Démo du produit : lignes de texte, deux curseurs, un commentaire — jouée une seule fois
function HeroDemo() {
  return (
    <figure
      role="img"
      aria-label="Aperçu animé : deux collaborateurs écrivent dans le même document et l'un d'eux laisse un commentaire."
      className="demo relative mx-auto w-full max-w-[34rem] rounded-xl border border-line bg-surface shadow-page"
    >
      <div className="flex items-center justify-between gap-3 border-b border-line px-5 py-3">
        <div className="flex min-w-0 items-center gap-2 text-sm text-ink">
          <FileText size={15} className="shrink-0 text-accent" />
          <span className="truncate">Compte rendu de la réunion produit</span>
        </div>
        <div className="demo-presence flex -space-x-1.5">
          <span style={cssVar('--n', 0)}><Avatar name="Inès" color={CARET_A} /></span>
          <span style={cssVar('--n', 1)}><Avatar name="Malik" color={CARET_B} /></span>
        </div>
      </div>

      <div className="px-5 pb-6 pt-6 sm:px-8">
        <p className="demo-title mb-5 text-2xl font-semibold tracking-tight text-ink">Priorités du trimestre</p>
        <div className="space-y-3.5">
          <div className="demo-line h-2.5 w-full rounded bg-line-strong" style={cssVar('--n', 0)} />
          <div className="relative">
            <div className="demo-line h-2.5 w-[84%] rounded bg-line-strong" style={cssVar('--n', 1)} />
            <div className="absolute left-[84%] top-0.5"><Caret name="Inès" color={CARET_A} className="demo-caret-a" /></div>
          </div>
          <div className="demo-line h-2.5 w-[92%] rounded bg-line-strong" style={cssVar('--n', 2)} />
          <div className="relative">
            <div className="demo-line h-2.5 w-[48%] rounded bg-line-strong" style={cssVar('--n', 3)} />
            <div className="absolute left-[48%] top-0.5"><Caret name="Malik" color={CARET_B} className="demo-caret-b" /></div>
          </div>
        </div>

        <div className="demo-comment mt-7 rounded-lg border border-line bg-canvas p-3.5">
          <div className="flex items-center gap-2 text-xs text-ink-soft">
            <Avatar name="Malik" color={CARET_B} size={20} />
            <span className="font-medium text-ink">Malik</span>
            <span>à l'instant</span>
          </div>
          <p className="mt-2 text-sm text-ink">On peut valider ce point avant vendredi ?</p>
        </div>
      </div>

      <div className="demo-saved flex items-center gap-1.5 border-t border-line px-5 py-2.5 text-xs text-ink-muted">
        <Check size={13} className="text-success" /> Enregistré
      </div>
    </figure>
  )
}

/* ─── Petites maquettes d'étape, composées avec les tokens ───────────────── */

function StageFrame({ children, label }: { children: ReactNode; label: string }) {
  return (
    <div role="img" aria-label={label} className="rounded-xl border border-line bg-surface p-5 shadow-page">
      {children}
    </div>
  )
}

function VisualWrite() {
  const items = ['Titre 1', 'Liste à puces', 'Liste de tâches']
  return (
    <StageFrame label="Menu de commandes ouvert en tapant une barre oblique dans le document.">
      <p className="text-[15px] text-ink">Objectifs de la semaine</p>
      <p className="mt-2 text-[15px] text-ink"><span className="num">/</span><span className="text-ink-muted">tâ</span></p>
      <ul className="mt-3 w-60 max-w-full rounded-lg bg-raised p-1 shadow-pop">
        {items.map((label, i) => (
          <li key={label} className={`rounded-md px-2.5 py-1.5 text-sm ${i === 2 ? 'bg-accent-soft font-medium text-accent' : 'text-ink'}`}>{label}</li>
        ))}
      </ul>
    </StageFrame>
  )
}

function VisualInvite() {
  const rows = [
    { name: 'Inès', role: 'Éditeur', color: CARET_A },
    { name: 'Malik', role: 'Commentaires uniquement', color: CARET_B },
    { name: 'Sofia', role: 'Lecture seule', color: CARET_C },
  ]
  return (
    <StageFrame label="Liste de personnes invitées avec leur rôle : éditeur, commentaires uniquement, lecture seule.">
      <p className="mb-3 text-sm font-medium text-ink">Partager le document</p>
      <ul className="divide-y divide-line">
        {rows.map(r => (
          <li key={r.name} className="flex items-center justify-between gap-3 py-2.5">
            <span className="flex min-w-0 items-center gap-2.5 text-sm text-ink"><Avatar name={r.name} color={r.color} size={26} />{r.name}</span>
            <span className="shrink-0 rounded-md border border-line-strong px-2 py-1 text-xs text-ink-soft">{r.role}</span>
          </li>
        ))}
      </ul>
    </StageFrame>
  )
}

function VisualComment() {
  return (
    <StageFrame label="Fil de commentaire avec une mention et un bouton pour le résoudre.">
      <div className="flex items-center gap-2 text-xs text-ink-soft">
        <Avatar name="Inès" color={CARET_A} size={22} />
        <span className="font-medium text-ink">Inès</span><span>il y a 5 minutes</span>
      </div>
      <p className="mt-2 text-sm leading-relaxed text-ink">
        <span className="mention">@Malik</span> peux-tu relire ce paragraphe avant l'envoi ?
      </p>
      <div className="mt-3 flex items-center gap-3 text-xs">
        <span className="text-ink-soft">Répondre</span>
        <span className="flex items-center gap-1 font-medium text-success"><Check size={13} /> Résoudre</span>
      </div>
    </StageFrame>
  )
}

function VisualHistory() {
  return (
    <StageFrame label="Comparaison entre deux versions : une ligne supprimée en rouge, une ligne ajoutée en vert.">
      <div className="mb-3 flex items-center justify-between text-sm">
        <span className="font-medium text-ink">Hier, 17:42</span>
        <span className="flex gap-3 text-xs text-ink-soft"><span>Comparer</span><span className="font-medium text-accent">Restaurer</span></span>
      </div>
      <div className="space-y-1.5 text-sm">
        <p className="rounded bg-danger-soft px-2.5 py-1 text-danger line-through decoration-danger/50">Lancement prévu en mars</p>
        <p className="rounded bg-success-soft px-2.5 py-1 text-success">Lancement prévu en avril</p>
      </div>
    </StageFrame>
  )
}

interface StageProps {
  n: string
  title: string
  icon: ReactNode
  text: string
  visual: ReactNode
  flip?: boolean
}

// Étape : filet épais numéroté, titre et texte d'un côté, maquette de l'autre
function Stage({ n, title, icon, text, visual, flip }: StageProps) {
  return (
    <article className="stage-rule pt-6">
      <div className="grid items-start gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] lg:gap-16">
        <div className={`reveal ${flip ? 'lg:order-2' : ''}`}>
          <div className="mb-4 flex items-center gap-3">
            <span className="num text-sm font-medium text-ink">{n}</span>
            <span className="text-accent">{icon}</span>
          </div>
          <h3 className="text-2xl font-semibold tracking-tight text-ink sm:text-3xl">{title}</h3>
          <p className="mt-3 max-w-md text-base leading-relaxed text-ink-soft">{text}</p>
        </div>
        <div className={`reveal min-w-0 ${flip ? 'lg:order-1' : ''}`} style={cssVar('--i', 2)}>{visual}</div>
      </div>
    </article>
  )
}

const ALSO = [
  ['Recherche instantanée', 'Ctrl K ou ⌘K ouvre la recherche : retrouvez une page en quelques lettres.'],
  ['Exports', 'Téléchargez un document en PDF, en HTML ou en Markdown.'],
  ['Import', 'Reprenez un document existant au lieu de repartir d\'une page blanche.'],
  ['Espaces de travail', 'Regroupez les pages et les membres d\'une même équipe.'],
  ['Notifications', 'Soyez prévenu quand quelqu\'un vous mentionne ou répond.'],
  ['Installable', 'Ajoutez-le à votre écran d\'accueil, comme une application.'],
] as const

export default function LandingPage() {
  const ref = useReveal<HTMLDivElement>()

  return (
    <div ref={ref} className="lp min-h-screen bg-surface font-sans text-ink antialiased">
      <Nav />

      <main>
        {/* Hero : titre et actions à gauche, démo du produit à droite */}
        <section className="mx-auto grid max-w-6xl items-center gap-12 px-5 pb-20 pt-28 sm:px-8 sm:pt-36 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,1fr)] lg:gap-16 lg:pb-28">
          <div className="min-w-0">
            <h1 className="text-[clamp(2.25rem,5vw+0.5rem,4.25rem)] font-semibold leading-[1.05] tracking-[-0.03em]">
              Écrivez à plusieurs, <span className="text-accent">sans jamais attendre.</span>
            </h1>
            <p className="mt-6 max-w-lg text-lg leading-relaxed text-ink-soft">
              Collab Editor est un éditeur de documents en temps réel. Vous voyez les curseurs de votre équipe, vous commentez au fil du texte et vous retrouvez chaque version.
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-3">
              <Button variant="primary" className="h-11 whitespace-nowrap px-6 text-[15px]" onClick={goRegister} icon={<ArrowRight size={16} />}>Créer un compte</Button>
              <Button className="h-11 whitespace-nowrap px-6 text-[15px]" onClick={goLogin}>Se connecter</Button>
            </div>
            <p className="mt-5 text-sm text-ink-muted">Dans le navigateur, sans rien installer, ou comme une application.</p>
          </div>
          <div className="min-w-0"><HeroDemo /></div>
        </section>

        {/* Parcours en quatre étapes */}
        <section id="fonctionnement" className="mx-auto max-w-6xl scroll-mt-20 px-5 pb-24 sm:px-8 lg:pb-32">
          <div className="reveal mb-14 max-w-2xl">
            <h2 className="text-3xl font-semibold tracking-tight sm:text-4xl">Du premier mot à la dernière version.</h2>
            <p className="mt-4 text-lg leading-relaxed text-ink-soft">Quatre étapes, dans l'ordre où votre équipe les vit.</p>
          </div>
          <div className="space-y-16 lg:space-y-24">
            <Stage n="1.0" icon={<FileText size={18} />} title="Écrire" visual={<VisualWrite />}
              text="Tapez / pour insérer un titre, une liste de tâches, une citation ou un bloc de code. Le texte s'enregistre tout seul pendant que vous écrivez." />
            <Stage n="2.0" icon={<Users size={18} />} title="Inviter" flip visual={<VisualInvite />}
              text="Partagez le document et choisissez ce que chacun peut faire : éditer, commenter seulement, ou simplement lire. Chaque collaborateur a sa couleur." />
            <Stage n="3.0" icon={<MessageSquare size={18} />} title="Commenter" visual={<VisualComment />}
              text="Posez une question sur un passage, mentionnez un collègue avec @, résolvez le fil quand c'est réglé. La personne mentionnée est notifiée." />
            <Stage n="4.0" icon={<History size={18} />} title="Revenir en arrière" flip visual={<VisualHistory />}
              text="Chaque version est conservée. Comparez deux états du document ligne à ligne, puis restaurez celui que vous voulez." />
          </div>
        </section>

        {/* Le reste, en liste typographique */}
        <section className="mx-auto max-w-6xl px-5 pb-24 sm:px-8 lg:pb-32">
          <h2 className="reveal text-2xl font-semibold tracking-tight sm:text-3xl">Et aussi</h2>
          <dl className="mt-8 grid gap-x-16 md:grid-cols-2">
            {ALSO.map(([term, desc], i) => (
              <div key={term} className="reveal border-t border-line py-5" style={cssVar('--i', i % 2)}>
                <dt className="text-base font-medium text-ink">{term}</dt>
                <dd className="mt-1 text-[15px] leading-relaxed text-ink-soft">{desc}</dd>
              </div>
            ))}
          </dl>
        </section>

        {/* Appel final : un seul, global */}
        <section className="border-t border-line bg-canvas">
          <div className="reveal mx-auto flex max-w-6xl flex-col items-start gap-8 px-5 py-20 sm:px-8 lg:flex-row lg:items-center lg:justify-between lg:py-24">
            <h2 className="max-w-xl text-3xl font-semibold tracking-tight sm:text-4xl">Commencez à l'étape 1.</h2>
            <div className="flex flex-wrap items-center gap-4">
              <Button variant="primary" className="h-11 whitespace-nowrap px-6 text-[15px]" onClick={goRegister} icon={<ArrowRight size={16} />}>Créer un compte</Button>
              <button onClick={goLogin} className="whitespace-nowrap text-[15px] font-medium text-accent underline-offset-4 hover:underline cursor-pointer">J'ai déjà un compte</button>
            </div>
          </div>
        </section>
      </main>

      {/* Ft2 · une seule ligne, filet au-dessus */}
      <footer className="border-t border-line">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 px-5 py-6 sm:px-8">
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-ink-soft">
            <Wordmark />
            <span>Écrire ensemble, en temps réel.</span>
          </div>
          <div className="flex items-center gap-4 text-sm text-ink-muted">
            <span>© {new Date().getFullYear()} Collab Editor</span>
            <ThemeToggle />
          </div>
        </div>
      </footer>
    </div>
  )
}
