import { useSyncExternalStore } from 'react'

// Routeur minimal basé sur le hash : les liens de documents sont partageables
export type Route =
  | { name: 'home' }
  | { name: 'login' }
  | { name: 'register' }
  | { name: 'document'; docId: string }

function parse(hash: string): Route {
  const match = hash.match(/^#\/d\/([A-Za-z0-9_-]+)/)
  if (match) return { name: 'document', docId: match[1] }
  if (hash === '#/login') return { name: 'login' }
  if (hash === '#/register') return { name: 'register' }
  return { name: 'home' }
}

function subscribe(callback: () => void) {
  window.addEventListener('hashchange', callback)
  return () => window.removeEventListener('hashchange', callback)
}

export function useRoute(): Route {
  const hash = useSyncExternalStore(subscribe, () => window.location.hash)
  return parse(hash)
}

export function navigate(route: Route) {
  window.location.hash = route.name === 'document' ? `/d/${route.docId}` : route.name === 'home' ? '/' : `/${route.name}`
}

export function documentUrl(docId: string): string {
  return `${window.location.origin}${window.location.pathname}#/d/${docId}`
}
