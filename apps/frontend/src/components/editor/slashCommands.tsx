import { Extension, type Editor, type Range } from '@tiptap/react'
import Suggestion from '@tiptap/suggestion'
import {
  CheckSquare, Code2, Heading1, Heading2, Heading3, List, ListOrdered, Minus, Pilcrow, Quote
} from 'lucide-react'
import type { ReactNode } from 'react'
import type { SuggestionItem } from './SuggestionMenu'
import { createSuggestionRenderer } from './suggestionRenderer'

interface SlashCommand extends SuggestionItem {
  keywords: string[]
  run: (editor: Editor, range: Range) => void
  icon: ReactNode
}

const COMMANDS: SlashCommand[] = [
  { id: 'text', label: 'Texte', description: 'Paragraphe simple', icon: <Pilcrow size={16} />, keywords: ['paragraphe', 'texte'],
    run: (e, r) => e.chain().focus().deleteRange(r).setParagraph().run() },
  { id: 'h1', label: 'Titre 1', description: 'Grand titre de section', icon: <Heading1 size={16} />, keywords: ['titre', 'heading', 'h1'],
    run: (e, r) => e.chain().focus().deleteRange(r).setHeading({ level: 1 }).run() },
  { id: 'h2', label: 'Titre 2', description: 'Titre de taille moyenne', icon: <Heading2 size={16} />, keywords: ['titre', 'heading', 'h2'],
    run: (e, r) => e.chain().focus().deleteRange(r).setHeading({ level: 2 }).run() },
  { id: 'h3', label: 'Titre 3', description: 'Petit titre', icon: <Heading3 size={16} />, keywords: ['titre', 'heading', 'h3'],
    run: (e, r) => e.chain().focus().deleteRange(r).setHeading({ level: 3 }).run() },
  { id: 'bullet', label: 'Liste à puces', description: 'Liste non ordonnée', icon: <List size={16} />, keywords: ['liste', 'puces', 'bullet'],
    run: (e, r) => e.chain().focus().deleteRange(r).toggleBulletList().run() },
  { id: 'ordered', label: 'Liste numérotée', description: 'Liste ordonnée', icon: <ListOrdered size={16} />, keywords: ['liste', 'numéro', 'ordered'],
    run: (e, r) => e.chain().focus().deleteRange(r).toggleOrderedList().run() },
  { id: 'todo', label: 'Liste de tâches', description: 'Cases à cocher', icon: <CheckSquare size={16} />, keywords: ['tâche', 'todo', 'case', 'checkbox'],
    run: (e, r) => e.chain().focus().deleteRange(r).toggleTaskList().run() },
  { id: 'quote', label: 'Citation', description: 'Mettre un passage en exergue', icon: <Quote size={16} />, keywords: ['citation', 'quote'],
    run: (e, r) => e.chain().focus().deleteRange(r).toggleBlockquote().run() },
  { id: 'code', label: 'Bloc de code', description: 'Extrait de code', icon: <Code2 size={16} />, keywords: ['code'],
    run: (e, r) => e.chain().focus().deleteRange(r).toggleCodeBlock().run() },
  { id: 'divider', label: 'Séparateur', description: 'Ligne horizontale', icon: <Minus size={16} />, keywords: ['séparateur', 'ligne', 'divider'],
    run: (e, r) => e.chain().focus().deleteRange(r).setHorizontalRule().run() },
]

function normalize(text: string) {
  return text.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
}

// Menu « / » à la Notion : insertion rapide de blocs
export const SlashCommands = Extension.create({
  name: 'slashCommands',

  addProseMirrorPlugins() {
    return [
      Suggestion<SuggestionItem>({
        editor: this.editor,
        char: '/',
        startOfLine: false,
        // « titre 2 » doit fonctionner comme dans Notion
        allowSpaces: true,
        items: ({ query }) => {
          const q = normalize(query)
          return COMMANDS.filter(c => normalize(c.label).includes(q) || c.keywords.some(k => normalize(k).includes(q)))
        },
        command: ({ editor, range, props }) => {
          COMMANDS.find(c => c.id === props.id)?.run(editor, range)
        },
        render: createSuggestionRenderer('Aucune commande')
      })
    ]
  }
})
