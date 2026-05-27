import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Underline from '@tiptap/extension-underline'
import { useAuthStore } from '../store/authStore'

export default function EditorPage() {
  const { user, logout } = useAuthStore()

  const editor = useEditor({
    extensions: [StarterKit, Underline],
    content: '<p>Commence a ecrire ici...</p>'
  })

  return (
    <div style={{ fontFamily: 'sans-serif' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 24px', borderBottom: '1px solid #eee' }}>
        <h3 style={{ margin: 0 }}>Editeur collaboratif</h3>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <span>{user?.email}</span>
          <button onClick={logout} style={{ padding: '6px 12px', cursor: 'pointer' }}>
            Deconnexion
          </button>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 8, padding: '8px 24px', borderBottom: '1px solid #eee' }}>
        <button onClick={() => editor?.chain().focus().toggleBold().run()}
          style={{ fontWeight: editor?.isActive('bold') ? 'bold' : 'normal', padding: '4px 10px' }}>
          G
        </button>
        <button onClick={() => editor?.chain().focus().toggleItalic().run()}
          style={{ fontStyle: 'italic', padding: '4px 10px' }}>
          I
        </button>
        <button onClick={() => editor?.chain().focus().toggleUnderline().run()}
          style={{ textDecoration: 'underline', padding: '4px 10px' }}>
          S
        </button>
        <button onClick={() => editor?.chain().focus().toggleHeading({ level: 1 }).run()}
          style={{ padding: '4px 10px' }}>
          H1
        </button>
        <button onClick={() => editor?.chain().focus().toggleHeading({ level: 2 }).run()}
          style={{ padding: '4px 10px' }}>
          H2
        </button>
        <button onClick={() => editor?.chain().focus().toggleBulletList().run()}
          style={{ padding: '4px 10px' }}>
          Liste
        </button>
        <button onClick={() => editor?.chain().focus().toggleCodeBlock().run()}
          style={{ padding: '4px 10px' }}>
          Code
        </button>
      </div>

      <div style={{ padding: 24, maxWidth: 800, margin: '0 auto' }}>
        <EditorContent editor={editor} />
      </div>
    </div>
  )
}