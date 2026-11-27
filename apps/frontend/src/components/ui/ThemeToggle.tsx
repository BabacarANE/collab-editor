import { Monitor, Moon, Sun } from 'lucide-react'
import { useThemeStore, type ThemeChoice } from '../../store/themeStore'

const OPTIONS: { value: ThemeChoice; label: string; icon: typeof Sun }[] = [
  { value: 'light', label: 'Thème clair', icon: Sun },
  { value: 'system', label: 'Thème du système', icon: Monitor },
  { value: 'dark', label: 'Thème sombre', icon: Moon },
]

// Sélecteur à trois états (clair / système / sombre), accessible au clavier
export function ThemeToggle({ className = '' }: { className?: string }) {
  const choice = useThemeStore(s => s.choice)
  const setChoice = useThemeStore(s => s.setChoice)

  return (
    <div role="radiogroup" aria-label="Apparence" className={`inline-flex rounded-md border border-line p-0.5 ${className}`}>
      {OPTIONS.map(({ value, label, icon: Icon }) => (
        <button
          key={value}
          type="button"
          role="radio"
          aria-checked={choice === value}
          aria-label={label}
          title={label}
          onClick={() => setChoice(value)}
          className={`flex h-6 w-7 items-center justify-center rounded transition-colors cursor-pointer ${
            choice === value ? 'bg-accent-soft text-accent' : 'text-ink-muted hover:text-ink'
          }`}
        >
          <Icon size={14} />
        </button>
      ))}
    </div>
  )
}
