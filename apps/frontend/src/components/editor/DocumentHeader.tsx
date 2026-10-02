import { Download, FileText, History, Link2, Menu as MenuIcon, MessageSquare, MoreHorizontal, Trash2, Users } from 'lucide-react'
import type { ExportFormat } from '../../api/endpoints'
import type { Collaborator } from '../../hooks/useCollaboration'
import { ROLE_BADGE, type Capabilities } from '../../lib/permissions'
import { navigate } from '../../lib/router'
import type { DocumentRole } from '../../types'
import NotificationBell from '../layout/NotificationBell'
import { Avatar } from '../ui/Avatar'
import { Button, IconButton } from '../ui/Button'
import { Menu, MenuItem, MenuLabel, MenuSeparator } from '../ui/Menu'

export type Panel = 'comments' | 'history' | null

interface Props {
  title: string
  role: DocumentRole | null
  capabilities: Capabilities
  collaborators: Collaborator[]
  status: React.ReactNode
  panel: Panel
  sidebarOpen: boolean
  onOpenSidebar: () => void
  onTogglePanel: (panel: Exclude<Panel, null>) => void
  onShare: () => void
  onExport: (format: ExportFormat) => void
  onCopyLink: () => void
  onDelete: () => void
}

const MAX_AVATARS = 4

// Barre supérieure de l'éditeur : titre, présence, panneaux, partage, actions
export default function DocumentHeader({
  title, role, capabilities, collaborators, status, panel, sidebarOpen,
  onOpenSidebar, onTogglePanel, onShare, onExport, onCopyLink, onDelete
}: Props) {
  return (
    <header className="flex h-12 shrink-0 items-center gap-2 border-b border-line bg-white px-3">
      {!sidebarOpen && (
        <IconButton label="Afficher la barre latérale" onClick={onOpenSidebar}><MenuIcon size={18} /></IconButton>
      )}
      <div className="flex min-w-0 flex-1 items-center gap-2">
        <FileText size={16} className="shrink-0 text-accent" />
        <span className="truncate text-sm text-ink">{title || 'Sans titre'}</span>
        {role && ROLE_BADGE[role] && (
          <span className="shrink-0 rounded-full bg-canvas px-2 py-0.5 text-xs text-ink-soft">{ROLE_BADGE[role]}</span>
        )}
        {status}
      </div>

      {/* Présence des collaborateurs */}
      <div className="hidden items-center -space-x-1.5 sm:flex">
        {collaborators.slice(0, MAX_AVATARS).map(c => (
          <Avatar key={c.clientId} email={c.name} color={c.color} size={28} ring />
        ))}
        {collaborators.length > MAX_AVATARS && (
          <span className="flex h-7 w-7 items-center justify-center rounded-full bg-canvas text-xs text-ink-soft ring-2 ring-white">
            +{collaborators.length - MAX_AVATARS}
          </span>
        )}
      </div>

      <IconButton label="Commentaires" active={panel === 'comments'} onClick={() => onTogglePanel('comments')}>
        <MessageSquare size={18} />
      </IconButton>
      <IconButton label="Historique des versions" active={panel === 'history'} onClick={() => onTogglePanel('history')}>
        <History size={18} />
      </IconButton>
      <NotificationBell onOpenDocument={id => navigate({ name: 'document', docId: id })} />

      {capabilities.canManage && (
        <Button variant="primary" size="sm" icon={<Users size={15} />} onClick={onShare} className="ml-1 h-8 rounded-full px-4">
          Partager
        </Button>
      )}

      <Menu
        align="right"
        trigger={({ toggle, open }) => (
          <IconButton label="Plus d'actions" active={open} onClick={toggle}><MoreHorizontal size={18} /></IconButton>
        )}
      >
        {close => (
          <>
            <MenuLabel>Télécharger</MenuLabel>
            <MenuItem icon={<Download size={14} />} onClick={() => { close(); onExport('pdf') }}>Document PDF (.pdf)</MenuItem>
            <MenuItem icon={<Download size={14} />} onClick={() => { close(); onExport('html') }}>Page web (.html)</MenuItem>
            <MenuItem icon={<Download size={14} />} onClick={() => { close(); onExport('md') }}>Markdown (.md)</MenuItem>
            <MenuSeparator />
            <MenuItem icon={<Link2 size={14} />} onClick={() => { close(); onCopyLink() }}>Copier le lien</MenuItem>
            {capabilities.canManage && (
              <MenuItem danger icon={<Trash2 size={14} />} onClick={() => { close(); onDelete() }}>Supprimer</MenuItem>
            )}
          </>
        )}
      </Menu>
    </header>
  )
}
