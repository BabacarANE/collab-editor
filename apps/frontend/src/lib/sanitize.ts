import DOMPurify from 'dompurify'

// Contenu de document (snapshots, aperçus) : HTML riche sans script ni handler
export function sanitizeHtml(html: string | null | undefined): string {
  return DOMPurify.sanitize(html ?? '', {
    USE_PROFILES: { html: true },
    FORBID_TAGS: ['style', 'iframe', 'object', 'embed', 'form'],
    FORBID_ATTR: ['style']
  })
}

// Extraits de recherche : seule la balise <mark> est conservée
export function sanitizeExcerpt(html: string | null | undefined): string {
  return DOMPurify.sanitize(html ?? '', { ALLOWED_TAGS: ['mark'], ALLOWED_ATTR: [] })
}
