import type { ButtonHTMLAttributes, ReactNode } from 'react'

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger'

const VARIANTS: Record<Variant, string> = {
  primary: 'bg-accent text-white hover:bg-accent-hover shadow-sm',
  secondary: 'bg-white text-ink border border-line-strong hover:bg-hover',
  ghost: 'text-ink-soft hover:bg-hover hover:text-ink',
  danger: 'bg-white text-red-600 border border-red-200 hover:bg-red-50',
}

interface Props extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant
  size?: 'sm' | 'md'
  icon?: ReactNode
}

export function Button({ variant = 'secondary', size = 'md', icon, className = '', children, ...rest }: Props) {
  const sizing = size === 'sm' ? 'h-7 px-2.5 text-[13px] gap-1.5' : 'h-9 px-4 text-sm gap-2'
  return (
    <button
      type="button"
      className={`inline-flex items-center justify-center rounded-md font-medium transition-colors disabled:opacity-50 disabled:pointer-events-none cursor-pointer ${sizing} ${VARIANTS[variant]} ${className}`}
      {...rest}
    >
      {icon}
      {children}
    </button>
  )
}

interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  label: string
  active?: boolean
}

// Bouton icône avec libellé accessible (aria-label + infobulle native)
export function IconButton({ label, active, className = '', children, ...rest }: IconButtonProps) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      aria-pressed={active}
      className={`inline-flex h-8 min-w-8 items-center justify-center rounded-md px-1.5 transition-colors cursor-pointer disabled:opacity-40 disabled:pointer-events-none ${
        active ? 'bg-accent-soft text-accent' : 'text-ink-soft hover:bg-hover hover:text-ink'
      } ${className}`}
      {...rest}
    >
      {children}
    </button>
  )
}
