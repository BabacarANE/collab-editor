interface Comment {
  id: string
  content: string
  resolved: boolean
  createdAt: string
  author: { id: string; email: string }
  replies: { id: string; content: string; author: { email: string } }[]
}

interface Props {
  comments: Comment[]
  newComment: string
  replyTo: { id: string; email: string } | null
  replyContent: string
  onNewCommentChange: (v: string) => void
  onPostComment: () => void
  onSetReplyTo: (c: { id: string; email: string } | null) => void
  onReplyContentChange: (v: string) => void
  onPostReply: (parentId: string) => void
  onResolve: (id: string) => void
}

export default function CommentsPanel({
  comments, newComment, replyTo, replyContent,
  onNewCommentChange, onPostComment, onSetReplyTo,
  onReplyContentChange, onPostReply, onResolve
}: Props) {
  return (
    <div className="w-72 border-l border-gray-200 flex flex-col gap-3 p-4 overflow-y-auto bg-gray-50">
      <span className="font-semibold text-sm text-gray-700">💬 Commentaires</span>

      <div className="flex flex-col gap-2">
        <textarea
          placeholder="Ajouter un commentaire..."
          value={newComment}
          onChange={e => onNewCommentChange(e.target.value)}
          rows={3}
          className="px-2.5 py-1.5 text-sm border border-gray-200 rounded resize-none focus:outline-none focus:border-blue-400 bg-white"
        />
        <button
          onClick={onPostComment}
          className="py-1.5 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors cursor-pointer"
        >
          + Commenter
        </button>
      </div>

      <hr className="border-gray-200" />

      {comments.length === 0 ? (
        <p className="text-sm text-gray-400">Aucun commentaire</p>
      ) : (
        <div className="flex flex-col gap-2">
          {comments.map(c => (
            <div
              key={c.id}
              className={`p-3 border rounded-lg ${c.resolved ? 'bg-gray-50 border-gray-100 opacity-60' : 'bg-white border-gray-200'}`}
            >
              <div className="flex justify-between items-center mb-1.5">
                <span className="text-xs font-semibold text-blue-600">{c.author.email}</span>
                <span className="text-xs text-gray-400">{new Date(c.createdAt).toLocaleDateString('fr-FR')}</span>
              </div>

              <p className="text-sm text-gray-700 mb-2 leading-relaxed">{c.content}</p>

              {c.replies?.length > 0 && (
                <div className="ml-3 border-l-2 border-gray-200 pl-2 flex flex-col gap-1 mb-2">
                  {c.replies.map(r => (
                    <div key={r.id}>
                      <span className="text-xs font-semibold text-gray-500">{r.author.email} </span>
                      <span className="text-xs text-gray-600">{r.content}</span>
                    </div>
                  ))}
                </div>
              )}

              {!c.resolved ? (
                <div className="flex gap-2">
                  <button
                    onClick={() => onSetReplyTo({ id: c.id, email: c.author.email })}
                    className="text-xs px-2 py-0.5 border border-gray-200 rounded hover:bg-gray-50 cursor-pointer"
                  >Répondre</button>
                  <button
                    onClick={() => onResolve(c.id)}
                    className="text-xs px-2 py-0.5 border border-emerald-300 text-emerald-600 rounded hover:bg-emerald-50 cursor-pointer"
                  >✓ Résoudre</button>
                </div>
              ) : (
                <span className="text-xs text-emerald-500">✓ Résolu</span>
              )}

              {replyTo?.id === c.id && (
                <div className="mt-2 flex flex-col gap-1">
                  <textarea
                    placeholder="Votre réponse..."
                    value={replyContent}
                    onChange={e => onReplyContentChange(e.target.value)}
                    rows={2}
                    className="px-2 py-1 text-xs border border-gray-200 rounded resize-none focus:outline-none focus:border-blue-400"
                  />
                  <div className="flex gap-1">
                    <button
                      onClick={() => onPostReply(c.id)}
                      className="text-xs px-2 py-1 bg-blue-600 text-white rounded hover:bg-blue-700 cursor-pointer"
                    >Envoyer</button>
                    <button
                      onClick={() => onSetReplyTo(null)}
                      className="text-xs px-2 py-1 border border-gray-200 rounded hover:bg-gray-50 cursor-pointer"
                    >Annuler</button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}