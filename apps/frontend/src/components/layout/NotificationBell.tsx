import { useEffect, useState } from 'react'
import { AtSign, Bell } from 'lucide-react'
import { notificationsApi } from '../../api/endpoints'
import { relativeTime } from '../../lib/format'
import type { AppNotification } from '../../types'
import { IconButton } from '../ui/Button'
import { Menu } from '../ui/Menu'

interface Props {
  onOpenDocument: (docId: string) => void
}

const POLL_INTERVAL_MS = 15_000

export default function NotificationBell({ onOpenDocument }: Props) {
  const [notifications, setNotifications] = useState<AppNotification[]>([])
  const unread = notifications.filter(n => !n.read).length

  useEffect(() => {
    const load = () =>
      notificationsApi.list()
        .then(setNotifications)
        .catch(() => { /* silencieux : nouvel essai au prochain intervalle */ })
    load()
    const interval = setInterval(load, POLL_INTERVAL_MS)
    return () => clearInterval(interval)
  }, [])

  const markAllRead = async () => {
    await notificationsApi.markAllRead()
    setNotifications(prev => prev.map(n => ({ ...n, read: true })))
  }

  const open = async (n: AppNotification, close: () => void) => {
    if (!n.read) {
      notificationsApi.markRead(n.id).catch(() => {})
      setNotifications(prev => prev.map(x => (x.id === n.id ? { ...x, read: true } : x)))
    }
    if (n.payload.documentId) {
      close()
      onOpenDocument(n.payload.documentId)
    }
  }

  return (
    <Menu
      align="right"
      width="w-80"
      trigger={({ toggle, open: isOpen }) => (
        <div className="relative">
          <IconButton label="Notifications" active={isOpen} onClick={toggle}>
            <Bell size={18} />
          </IconButton>
          {unread > 0 && (
            <span className="pointer-events-none absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-danger px-1 text-[10px] font-semibold text-accent-ink">
              {unread > 9 ? '9+' : unread}
            </span>
          )}
        </div>
      )}
    >
      {close => (
        <div>
          <div className="flex items-center justify-between px-2 py-1.5">
            <span className="text-sm font-semibold text-ink">Notifications</span>
            {unread > 0 && (
              <button onClick={markAllRead} className="text-xs text-accent hover:underline cursor-pointer">Tout marquer comme lu</button>
            )}
          </div>
          <div className="max-h-96 overflow-y-auto">
            {notifications.length === 0 ? (
              <div className="px-2 py-8 text-center text-sm text-ink-muted">Vous êtes à jour</div>
            ) : notifications.map(n => (
              <button
                key={n.id}
                onClick={() => open(n, close)}
                className="flex w-full items-start gap-3 rounded-md px-2 py-2 text-left hover:bg-hover cursor-pointer"
              >
                <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-accent-soft text-accent">
                  <AtSign size={14} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className={`block text-sm ${n.read ? 'text-ink-soft' : 'font-medium text-ink'}`}>{n.payload.message}</span>
                  {n.payload.documentTitle && <span className="block truncate text-xs text-ink-muted">dans {n.payload.documentTitle}</span>}
                  <span className="block text-xs text-ink-muted">{relativeTime(n.createdAt)}</span>
                </span>
                {!n.read && <span className="mt-2 h-2 w-2 shrink-0 rounded-full bg-accent" />}
              </button>
            ))}
          </div>
        </div>
      )}
    </Menu>
  )
}
