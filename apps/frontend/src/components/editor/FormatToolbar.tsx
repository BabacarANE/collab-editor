import { useState } from 'react'
import { useEditorState, type Editor } from '@tiptap/react'
import {
  Bold, CheckSquare, Code, Code2, Highlighter, Italic, Link as LinkIcon, List, ListOrdered,
  Minus, Quote, Redo2, RemoveFormatting, Strikethrough, Underline, Undo2
} from 'lucide-react'
import { IconButton } from '../ui/Button'
import PromptDialog from '../dialogs/PromptDialog'

interface Props {
  editor: Editor
}

const BLOCK_TYPES = [
  { value: 'paragraph', label: 'Texte normal' },
  { value: 'h1', label: 'Titre 1' },
  { value: 'h2', label: 'Titre 2' },
  { value: 'h3', label: 'Titre 3' },
] as const

function Divider() {
  return <span className="mx-1 h-5 w-px shrink-0 bg-line-strong" />
}

// Barre d'outils compacte façon Google Docs ; l'état actif suit la sélection
export default function FormatToolbar({ editor }: Props) {
  const [linkDialog, setLinkDialog] = useState(false)
  const state = useEditorState({
    editor,
    selector: ({ editor: e }) => ({
      block: e.isActive('heading', { level: 1 }) ? 'h1'
        : e.isActive('heading', { level: 2 }) ? 'h2'
        : e.isActive('heading', { level: 3 }) ? 'h3'
        : 'paragraph',
      bold: e.isActive('bold'),
      italic: e.isActive('italic'),
      underline: e.isActive('underline'),
      strike: e.isActive('strike'),
      highlight: e.isActive('highlight'),
      code: e.isActive('code'),
      link: e.isActive('link'),
      bulletList: e.isActive('bulletList'),
      orderedList: e.isActive('orderedList'),
      taskList: e.isActive('taskList'),
      blockquote: e.isActive('blockquote'),
      codeBlock: e.isActive('codeBlock'),
    })
  })

  const chain = () => editor.chain().focus()

  const setBlock = (value: string) => {
    if (value === 'paragraph') chain().setParagraph().run()
    else chain().setHeading({ level: Number(value.slice(1)) as 1 | 2 | 3 }).run()
  }

  const toggleLink = () => {
    if (state.link) {
      chain().extendMarkRange('link').unsetLink().run()
      return
    }
    setLinkDialog(true)
  }

  const applyLink = (url: string) => {
    // Seuls les liens web et mail sont acceptés (pas de javascript:)
    const href = /^(https?:|mailto:)/i.test(url) ? url : `https://${url}`
    chain().extendMarkRange('link').setLink({ href }).run()
  }

  return (
    <div className="flex items-center gap-0.5 overflow-x-auto rounded-full bg-canvas px-3 py-1" role="toolbar" aria-label="Mise en forme">
      <IconButton label="Annuler (Ctrl+Z)" onClick={() => chain().undo().run()}><Undo2 size={16} /></IconButton>
      <IconButton label="Rétablir (Ctrl+Y)" onClick={() => chain().redo().run()}><Redo2 size={16} /></IconButton>
      <Divider />
      <select
        aria-label="Style de paragraphe"
        value={state.block}
        onChange={e => setBlock(e.target.value)}
        className="h-8 shrink-0 cursor-pointer rounded-md bg-transparent px-2 text-sm text-ink hover:bg-hover focus:outline-none"
      >
        {BLOCK_TYPES.map(b => <option key={b.value} value={b.value}>{b.label}</option>)}
      </select>
      <Divider />
      <IconButton label="Gras (Ctrl+B)" active={state.bold} onClick={() => chain().toggleBold().run()}><Bold size={16} /></IconButton>
      <IconButton label="Italique (Ctrl+I)" active={state.italic} onClick={() => chain().toggleItalic().run()}><Italic size={16} /></IconButton>
      <IconButton label="Souligné (Ctrl+U)" active={state.underline} onClick={() => chain().toggleUnderline().run()}><Underline size={16} /></IconButton>
      <IconButton label="Barré" active={state.strike} onClick={() => chain().toggleStrike().run()}><Strikethrough size={16} /></IconButton>
      <IconButton label="Surligner" active={state.highlight} onClick={() => chain().toggleHighlight().run()}><Highlighter size={16} /></IconButton>
      <IconButton label="Code" active={state.code} onClick={() => chain().toggleCode().run()}><Code size={16} /></IconButton>
      <IconButton label="Lien" active={state.link} onClick={toggleLink}><LinkIcon size={16} /></IconButton>
      <Divider />
      <IconButton label="Liste à puces" active={state.bulletList} onClick={() => chain().toggleBulletList().run()}><List size={16} /></IconButton>
      <IconButton label="Liste numérotée" active={state.orderedList} onClick={() => chain().toggleOrderedList().run()}><ListOrdered size={16} /></IconButton>
      <IconButton label="Liste de tâches" active={state.taskList} onClick={() => chain().toggleTaskList().run()}><CheckSquare size={16} /></IconButton>
      <Divider />
      <IconButton label="Citation" active={state.blockquote} onClick={() => chain().toggleBlockquote().run()}><Quote size={16} /></IconButton>
      <IconButton label="Bloc de code" active={state.codeBlock} onClick={() => chain().toggleCodeBlock().run()}><Code2 size={16} /></IconButton>
      <IconButton label="Séparateur" onClick={() => chain().setHorizontalRule().run()}><Minus size={16} /></IconButton>
      <IconButton label="Effacer la mise en forme" onClick={() => chain().unsetAllMarks().clearNodes().run()}><RemoveFormatting size={16} /></IconButton>

      {linkDialog && (
        <PromptDialog
          title="Insérer un lien"
          label="Adresse"
          placeholder="https://exemple.com"
          confirmLabel="Appliquer"
          validate={v => (!v ? 'Saisissez une adresse' : /^[a-z]+:/i.test(v) && !/^(https?|mailto):/i.test(v) ? 'Seuls les liens http(s) et mailto sont acceptés' : null)}
          onConfirm={applyLink}
          onClose={() => setLinkDialog(false)}
        />
      )}
    </div>
  )
}
