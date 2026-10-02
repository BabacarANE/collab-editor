import StarterKit from '@tiptap/starter-kit'
import Collaboration from '@tiptap/extension-collaboration'
import CollaborationCaret from '@tiptap/extension-collaboration-caret'
import Mention from '@tiptap/extension-mention'
import Highlight from '@tiptap/extension-highlight'
import { TaskList } from '@tiptap/extension-task-list'
import { TaskItem } from '@tiptap/extension-task-item'
import { CharacterCount, Placeholder } from '@tiptap/extensions'
import type { WebsocketProvider } from 'y-websocket'
import type * as Y from 'yjs'
import type { SuggestionItem } from './SuggestionMenu'
import { SlashCommands } from './slashCommands'
import { createSuggestionRenderer } from './suggestionRenderer'

interface Options {
  ydoc: Y.Doc
  provider: WebsocketProvider
  user: { name: string; color: string }
  searchMentions: (query: string) => Promise<SuggestionItem[]>
}

export function buildExtensions({ ydoc, provider, user, searchMentions }: Options) {
  return [
    StarterKit.configure({
      // L'historique est géré par Yjs (extension Collaboration)
      undoRedo: false,
      link: {
        openOnClick: false,
        autolink: true,
        protocols: ['http', 'https', 'mailto'],
        HTMLAttributes: { rel: 'noopener noreferrer nofollow', target: '_blank' }
      }
    }),
    Highlight,
    TaskList,
    TaskItem.configure({ nested: true }),
    CharacterCount,
    Placeholder.configure({
      placeholder: ({ node }) =>
        node.type.name === 'heading' ? 'Titre' : 'Écrivez quelque chose, ou tapez « / » pour les commandes…'
    }),
    Collaboration.configure({ document: ydoc }),
    // Curseurs colorés et nommés des collaborateurs (façon Google Docs)
    CollaborationCaret.configure({ provider, user }),
    SlashCommands,
    Mention.configure({
      HTMLAttributes: { class: 'mention' },
      suggestion: {
        items: ({ query }) => searchMentions(query),
        render: createSuggestionRenderer('Aucun membre trouvé')
      }
    })
  ]
}
