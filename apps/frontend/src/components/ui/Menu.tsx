import { useEffect, useRef, useState, type ReactNode } from 'react'

interface MenuProps {
  trigger: (props: { open: boolean; toggle: () => void }) => ReactNode
  children: (close: () => void) => ReactNode
  align?: 'left' | 'right'
  width?: string
}

// Menu déroulant : fermeture au clic extérieur et à Échap
export function Menu({ trigger, children, align = 'left', width = 'w-56' }: MenuProps) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false)
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  return (
    <div ref={ref} className="relative">
      {trigger({ open, toggle: () => setOpen(o => !o) })}
      {open && (
        <div
          role="menu"
          className={`absolute top-full z-40 mt-1 ${width} rounded-lg bg-raised p-1 shadow-pop animate-pop-in ${align === 'right' ? 'right-0' : 'left-0'}`}
        >
          {children(() => setOpen(false))}
        </div>
      )}
    </div>
  )
}

interface ItemProps {
  icon?: ReactNode
  children: ReactNode
  onClick: () => void
  danger?: boolean
  hint?: ReactNode
}

export function MenuItem({ icon, children, onClick, danger, hint }: ItemProps) {
  return (
    <button
      role="menuitem"
      type="button"
      onClick={onClick}
      className={`flex w-full items-center gap-2.5 rounded-md px-2 py-1.5 text-left text-sm cursor-pointer ${
        danger ? 'text-danger hover:bg-danger-soft' : 'text-ink hover:bg-hover'
      }`}
    >
      {icon && <span className="flex w-4 justify-center text-ink-soft">{icon}</span>}
      <span className="flex-1 truncate">{children}</span>
      {hint && <span className="text-xs text-ink-muted">{hint}</span>}
    </button>
  )
}

export function MenuSeparator() {
  return <div className="my-1 h-px bg-line" />
}

export function MenuLabel({ children }: { children: ReactNode }) {
  return <div className="px-2 pb-1 pt-1.5 text-xs font-medium text-ink-muted">{children}</div>
}
