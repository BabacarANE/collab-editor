import { Editor } from '@tiptap/react'

interface Props {
  editor: Editor | null
  myRole: string
  showHistory: boolean
  showComments: boolean
  showPermissions: boolean
  onToggleHistory: () => void
  onToggleComments: () => void
  onTogglePermissions: () => void
  onExport: (format: 'html' | 'md' | 'pdf') => void
}

const btnBase = 'px-2.5 py-1 text-sm rounded border border-gray-200 hover:bg-gray-100 transition-colors cursor-pointer bg-white'
const btnActive = 'px-2.5 py-1 text-sm rounded border border-blue-200 bg-blue-50 text-blue-600 cursor-pointer'

export default function EditorToolbar({
  editor, myRole, showHistory, showComments, showPermissions,
  onToggleHistory, onToggleComments, onTogglePermissions, onExport
}: Props) {
  const canEdit = myRole !== 'VIEWER' && myRole !== 'COMMENTER'

  return (
    <div className="flex items-center gap-1.5 px-6 py-2 border-b border-gray-200 bg-white flex-wrap">
      {canEdit && (
        <>
          <button
            onClick={() => editor?.chain().focus().toggleBold().run()}
            className={`${btnBase} font-bold w-8 ${editor?.isActive('bold') ? 'bg-gray-100' : ''}`}
          >B</button>
          <button
            onClick={() => editor?.chain().focus().toggleItalic().run()}
            className={`${btnBase} italic w-8 ${editor?.isActive('italic') ? 'bg-gray-100' : ''}`}
          >I</button>
          <button
            onClick={() => editor?.chain().focus().toggleStrike().run()}
            className={`${btnBase} line-through w-8`}
          >S</button>
          <div className="w-px h-5 bg-gray-200 mx-1" />
          <button onClick={() => editor?.chain().focus().toggleHeading({ level: 1 }).run()} className={btnBase}>H1</button>
          <button onClick={() => editor?.chain().focus().toggleHeading({ level: 2 }).run()} className={btnBase}>H2</button>
          <button onClick={() => editor?.chain().focus().toggleHeading({ level: 3 }).run()} className={btnBase}>H3</button>
          <div className="w-px h-5 bg-gray-200 mx-1" />
          <button onClick={() => editor?.chain().focus().toggleBulletList().run()} className={btnBase}>• Liste</button>
          <button onClick={() => editor?.chain().focus().toggleOrderedList().run()} className={btnBase}>1. Liste</button>
          <button onClick={() => editor?.chain().focus().toggleCodeBlock().run()} className={btnBase}>{'</>'}</button>
          <div className="w-px h-5 bg-gray-200 mx-1" />
        </>
      )}

      <div className="ml-auto flex items-center gap-1.5">
        <button onClick={() => onExport('html')} className={btnBase}>↓ HTML</button>
        <button onClick={() => onExport('md')} className={btnBase}>↓ MD</button>
        <button onClick={() => onExport('pdf')} className={btnBase}>↓ PDF</button>
        <div className="w-px h-5 bg-gray-200 mx-1" />
        <button onClick={onToggleHistory} className={showHistory ? btnActive : btnBase}>🕐 Versions</button>
        <button onClick={onToggleComments} className={showComments ? btnActive : btnBase}>💬 Commentaires</button>
        {myRole === 'OWNER' && (
          <button onClick={onTogglePermissions} className={showPermissions ? btnActive : btnBase}>🔐 Partage</button>
        )}
      </div>
    </div>
  )
}