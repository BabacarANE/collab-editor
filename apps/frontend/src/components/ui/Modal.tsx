import { useEffect, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { X } from 'lucide-react'

interface Props {
  title?: ReactNode
  onClose: () => void
  children: ReactNode
  footer?: ReactNode
  width?: string
}

export function Modal({ title, onClose, children, footer, width = 'max-w-lg' }: Props) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/40 px-4 py-[10vh] animate-fade-in"
      onMouseDown={e => e.target === e.currentTarget && onClose()}
    >
      <div role="dialog" aria-modal="true" className={`w-full ${width} rounded-xl bg-white shadow-pop animate-pop-in`}>
        {title && (
          <div className="flex items-center justify-between gap-4 px-6 pt-5">
            <h2 className="text-lg font-semibold text-ink">{title}</h2>
            <button onClick={onClose} aria-label="Fermer" className="rounded-md p-1 text-ink-muted hover:bg-hover hover:text-ink cursor-pointer">
              <X size={18} />
            </button>
          </div>
        )}
        <div className="px-6 py-4">{children}</div>
        {footer && <div className="flex items-center justify-end gap-2 border-t border-line px-6 py-3">{footer}</div>}
      </div>
    </div>,
    document.body
  )
}
