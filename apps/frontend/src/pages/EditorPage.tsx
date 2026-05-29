import { useEffect, useState } from 'react'
import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Underline from '@tiptap/extension-underline'
import { useAuthStore } from '../store/authStore'
import { api } from '../api/client'

interface Props {
  docId: string
  onBack: () => void
}

export default function EditorPage({ docId, onBack }: Props) {
  const { user, logout } = useAuthStore()
  const [docTitle, setDocTitle] = useState('Sans titre')

  // Charger le titre du document au montage
  useEffect(() => {
    api.get(`/api/documents/${docId}`)
      .then(res => setDocTitle(res.data.title))
      .catch(() => setDocTitle('Document'))
  }, [docId])

  const editor = useEditor({
    extensions: [StarterKit, Underline],
    content: '<p>Commence à écrire ici...</p>'
  })

  return (
    <div style={{ fontFamily: 'sans-serif' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 24px', borderBottom: '1px solid #eee' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <button
            onClick={onBack}
            style={{ padding: '6px 12px', cursor: 'pointer', background: 'none', border: '1px solid #ddd', borderRadius: 4 }}
          >
            ← Retour
          </button>
          <h3 style={{ margin: 0 }}>📄 {docTitle}</h3>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <span style={{ color: '#666', fontSize: 14 }}>{user?.email}</span>
          <button onClick={logout} style={{ padding: '6px 12px', cursor: 'pointer' }}>
            Déconnexion
          </button>
        </div>
      </div>

      {/* Toolbar */}
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

      {/* Zone d'édition */}
      <div style={{ padding: 24, maxWidth: 800, margin: '0 auto' }}>
        <EditorContent editor={editor} />
      </div>
    </div>
  )
}