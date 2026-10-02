import { forwardRef, useEffect, useImperativeHandle, useRef, useState, type ReactNode } from 'react'

export interface SuggestionItem {
  id: string
  label: string
  description?: string
  icon?: ReactNode
}

interface Props {
  items: SuggestionItem[]
  command: (item: SuggestionItem) => void
  emptyLabel?: string
}

export interface SuggestionMenuHandle {
  onKeyDown: (props: { event: KeyboardEvent }) => boolean
}

// Liste au clavier partagée par les mentions (@) et les commandes (/)
const SuggestionMenu = forwardRef<SuggestionMenuHandle, Props>(({ items, command, emptyLabel = 'Aucun résultat' }, ref) => {
  const [selected, setSelected] = useState(0)
  const listRef = useRef<HTMLDivElement>(null)

  useEffect(() => setSelected(0), [items])

  useEffect(() => {
    listRef.current?.querySelector<HTMLElement>(`[data-index="${selected}"]`)?.scrollIntoView({ block: 'nearest' })
  }, [selected])

  useImperativeHandle(ref, () => ({
    onKeyDown: ({ event }) => {
      if (items.length === 0) return false
      if (event.key === 'ArrowUp') {
        setSelected(i => (i + items.length - 1) % items.length)
        return true
      }
      if (event.key === 'ArrowDown') {
        setSelected(i => (i + 1) % items.length)
        return true
      }
      if (event.key === 'Enter' || event.key === 'Tab') {
        command(items[selected])
        return true
      }
      return false
    }
  }), [items, selected, command])

  return (
    <div ref={listRef} className="max-h-80 w-72 overflow-y-auto rounded-lg bg-white p-1 shadow-pop">
      {items.length === 0 ? (
        <div className="px-3 py-2 text-sm text-ink-muted">{emptyLabel}</div>
      ) : items.map((item, index) => (
        <button
          key={item.id}
          data-index={index}
          onMouseEnter={() => setSelected(index)}
          onMouseDown={e => { e.preventDefault(); command(item) }}
          className={`flex w-full items-center gap-3 rounded-md px-2 py-1.5 text-left cursor-pointer ${index === selected ? 'bg-hover' : ''}`}
        >
          {item.icon && (
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-line bg-white text-ink-soft">
              {item.icon}
            </span>
          )}
          <span className="min-w-0">
            <span className="block truncate text-sm text-ink">{item.label}</span>
            {item.description && <span className="block truncate text-xs text-ink-muted">{item.description}</span>}
          </span>
        </button>
      ))}
    </div>
  )
})
SuggestionMenu.displayName = 'SuggestionMenu'

export default SuggestionMenu
