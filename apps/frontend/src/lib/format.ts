const rtf = new Intl.RelativeTimeFormat('fr', { numeric: 'auto' })

// « il y a 5 minutes », « hier »… puis date courte au-delà d'une semaine
export function relativeTime(date: string | Date): string {
  const d = typeof date === 'string' ? new Date(date) : date
  const seconds = Math.round((d.getTime() - Date.now()) / 1000)
  const abs = Math.abs(seconds)
  if (abs < 60) return 'à l\'instant'
  if (abs < 3600) return rtf.format(Math.round(seconds / 60), 'minute')
  if (abs < 86400) return rtf.format(Math.round(seconds / 3600), 'hour')
  if (abs < 604800) return rtf.format(Math.round(seconds / 86400), 'day')
  return d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' })
}

export function initials(email: string): string {
  return (email.split('@')[0] || '?').slice(0, 2).toUpperCase()
}

const COLORS = ['#e2445c', '#f2994a', '#d4a72c', '#27ae60', '#2d9cdb', '#7b61ff', '#c2185b', '#00897b']

export function colorFor(id: string): string {
  let hash = 0
  for (let i = 0; i < id.length; i++) hash = id.charCodeAt(i) + ((hash << 5) - hash)
  return COLORS[Math.abs(hash) % COLORS.length]
}

export function apiError(err: unknown, fallback: string): string {
  const data = (err as { response?: { data?: { error?: string } } })?.response?.data
  return data?.error ?? fallback
}

export function safeStorage() {
  return {
    get(key: string): string | null {
      try { return localStorage.getItem(key) } catch { return null }
    },
    set(key: string, value: string) {
      try { localStorage.setItem(key, value) } catch { /* stockage indisponible */ }
    }
  }
}
