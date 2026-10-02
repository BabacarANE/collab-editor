// En-tête Content-Disposition sûr : nom ASCII de repli + nom UTF-8 (RFC 5987)
export function contentDisposition(baseName: string, extension: string): string {
  const name = `${baseName || 'document'}.${extension}`
  const asciiFallback = name.replace(/[^\x20-\x7E]/g, '_').replace(/["\\]/g, '_')
  return `attachment; filename="${asciiFallback}"; filename*=UTF-8''${encodeURIComponent(name)}`
}
