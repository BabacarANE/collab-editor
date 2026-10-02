import { ReactRenderer } from '@tiptap/react'
import type { SuggestionKeyDownProps, SuggestionProps } from '@tiptap/suggestion'
import tippy, { type Instance } from 'tippy.js'
import SuggestionMenu, { type SuggestionItem, type SuggestionMenuHandle } from './SuggestionMenu'

// Fabrique le cycle de vie (création, mise à jour, clavier, fermeture) d'un
// menu de suggestion positionné sous le curseur
export function createSuggestionRenderer(emptyLabel?: string) {
  return () => {
    let component: ReactRenderer<SuggestionMenuHandle> | null = null
    let popup: Instance | null = null

    const toMenuProps = (props: SuggestionProps<SuggestionItem>) => ({
      items: props.items,
      command: (item: SuggestionItem) => props.command(item),
      emptyLabel
    })

    return {
      onStart: (props: SuggestionProps<SuggestionItem>) => {
        component = new ReactRenderer(SuggestionMenu, { props: toMenuProps(props), editor: props.editor })
        if (!props.clientRect) return
        popup = tippy(document.body, {
          getReferenceClientRect: () => props.clientRect?.() ?? new DOMRect(),
          appendTo: () => document.body,
          content: component.element,
          showOnCreate: true,
          interactive: true,
          trigger: 'manual',
          placement: 'bottom-start',
          offset: [0, 6]
        })
      },
      onUpdate: (props: SuggestionProps<SuggestionItem>) => {
        component?.updateProps(toMenuProps(props))
        popup?.setProps({ getReferenceClientRect: () => props.clientRect?.() ?? new DOMRect() })
      },
      onKeyDown: (props: SuggestionKeyDownProps) => {
        if (props.event.key === 'Escape') {
          popup?.hide()
          return true
        }
        return component?.ref?.onKeyDown(props) ?? false
      },
      onExit: () => {
        popup?.destroy()
        component?.destroy()
        popup = null
        component = null
      }
    }
  }
}
