import { useState, useEffect, useRef } from 'react'
import { api } from '../api/client'

interface Notification {
  id: string
  type: string
  payload: {
    message: string
    documentId?: string
    documentTitle?: string
    mentionedBy?: string
  }
  read: boolean
  createdAt: string
}

interface Props {
  onOpenDocument: (docId: string) => void
}

export default function NotificationBell({ onOpenDocument }: Props) {
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  const unread = notifications.filter(n => !n.read).length

  const load = async () => {
    try {
      const res = await api.get('/api/notifications')
      setNotifications(res.data)
    } catch {
      // silencieux
    }
  }

  useEffect(() => {
    load()
    // Polling toutes les 15s pour les nouvelles notifications
    const interval = setInterval(load, 15000)
    return () => clearInterval(interval)
  }, [])

  // Fermer en cliquant ailleurs
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const markAllRead = async () => {
    await api.patch('/api/notifications/read-all')
    setNotifications(prev => prev.map(n => ({ ...n, read: true })))
  }

  const handleClick = async (n: Notification) => {
    if (!n.read) {
      await api.patch(`/api/notifications/${n.id}/read`)
      setNotifications(prev => prev.map(x => x.id === n.id ? { ...x, read: true } : x))
    }
    if (n.payload.documentId) {
      setOpen(false)
      onOpenDocument(n.payload.documentId)
    }
  }

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button
        onClick={() => setOpen(!open)}
        style={{
          position: 'relative',
          background: 'none',
          border: '1px solid #ddd',
          borderRadius: 6,
          padding: '6px 10px',
          cursor: 'pointer',
          fontSize: 16
        }}
      >
        🔔
        {unread > 0 && (
          <span style={{
            position: 'absolute',
            top: -4,
            right: -4,
            background: '#ef4444',
            color: 'white',
            borderRadius: '50%',
            width: 16,
            height: 16,
            fontSize: 10,
            fontWeight: 700,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}>
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </button>

      {open && (
        <div style={{
          position: 'absolute',
          top: '110%',
          right: 0,
          width: 320,
          background: 'white',
          border: '1px solid #eee',
          borderRadius: 8,
          boxShadow: '0 4px 16px rgba(0,0,0,0.1)',
          zIndex: 100,
          overflow: 'hidden'
        }}>
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            padding: '10px 14px',
            borderBottom: '1px solid #eee'
          }}>
            <span style={{ fontWeight: 600, fontSize: 14 }}>Notifications</span>
            {unread > 0 && (
              <button onClick={markAllRead}
                style={{ fontSize: 12, color: '#1a73e8', background: 'none', border: 'none', cursor: 'pointer' }}>
                Tout marquer lu
              </button>
            )}
          </div>

          <div style={{ maxHeight: 360, overflowY: 'auto' }}>
            {notifications.length === 0 ? (
              <div style={{ padding: 16, fontSize: 13, color: '#999', textAlign: 'center' }}>
                Aucune notification
              </div>
            ) : (
              notifications.map(n => (
                <div
                  key={n.id}
                  onClick={() => handleClick(n)}
                  style={{
                    padding: '10px 14px',
                    borderBottom: '1px solid #f5f5f5',
                    cursor: n.payload.documentId ? 'pointer' : 'default',
                    background: n.read ? 'white' : '#f0f7ff'
                  }}
                  onMouseEnter={e => (e.currentTarget.style.background = n.read ? '#fafafa' : '#e8f0fe')}
                  onMouseLeave={e => (e.currentTarget.style.background = n.read ? 'white' : '#f0f7ff')}
                >
                  <div style={{ fontSize: 13, color: '#1a1a1a', marginBottom: 2 }}>
                    {n.payload.message}
                  </div>
                  {n.payload.documentTitle && (
                    <div style={{ fontSize: 12, color: '#1a73e8' }}>
                      📄 {n.payload.documentTitle}
                    </div>
                  )}
                  <div style={{ fontSize: 11, color: '#bbb', marginTop: 3 }}>
                    {new Date(n.createdAt).toLocaleDateString('fr-FR', {
                      day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit'
                    })}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  )
}
