import sanitizeHtml from 'sanitize-html'

// Liste blanche alignée sur les nœuds produits par l'éditeur Tiptap.
// Tout le reste (script, iframe, img, style, on*=...) est supprimé.
const DOCUMENT_HTML_OPTIONS: sanitizeHtml.IOptions = {
  allowedTags: [
    'p', 'br', 'hr', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
    'strong', 'b', 'em', 'i', 'u', 's', 'strike', 'del', 'mark', 'sub', 'sup',
    'code', 'pre', 'blockquote',
    'ul', 'ol', 'li', 'label', 'input', 'div', 'span',
    'a',
    'table', 'thead', 'tbody', 'tr', 'th', 'td'
  ],
  allowedAttributes: {
    a: ['href', 'target', 'rel'],
    span: ['class', 'data-type', 'data-id', 'data-label', 'data-mention-suggestion-char'],
    ul: ['data-type'],
    li: ['data-type', 'data-checked'],
    input: ['type', 'checked', 'disabled'],
    ol: ['start'],
    code: ['class'],
    pre: ['class'],
    th: ['colspan', 'rowspan'],
    td: ['colspan', 'rowspan']
  },
  allowedSchemes: ['http', 'https', 'mailto'],
  allowProtocolRelative: false,
  transformTags: {
    a: sanitizeHtml.simpleTransform('a', { rel: 'noopener noreferrer nofollow' }),
    // Seules les cases à cocher (task list) sont autorisées
    input: (tagName, attribs) =>
      attribs.type === 'checkbox'
        ? { tagName, attribs: { type: 'checkbox', ...(attribs.checked !== undefined ? { checked: '' } : {}), disabled: '' } }
        : { tagName: 'span', attribs: {} }
  }
}

export function sanitizeDocumentHtml(html: string | null | undefined): string {
  if (!html) return ''
  return sanitizeHtml(html, DOCUMENT_HTML_OPTIONS)
}

export function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

// En-tête Content-Disposition sûr : nom ASCII de repli + nom UTF-8 (RFC 5987)
export function contentDisposition(baseName: string, extension: string): string {
  const name = `${baseName || 'document'}.${extension}`
  const asciiFallback = name.replace(/[^\x20-\x7E]/g, '_').replace(/["\\]/g, '_')
  return `attachment; filename="${asciiFallback}"; filename*=UTF-8''${encodeURIComponent(name)}`
}
