import { NodeHtmlMarkdown } from 'node-html-markdown'
import { escapeHtml } from '../../infrastructure/html'
import type { PdfRenderer } from '../ports'
import type { DocumentExporter, ExportableDocument, ExportResult } from './DocumentExporter'

const PAGE_STYLE = `
  body { font-family: sans-serif; max-width: 800px; margin: 40px auto; padding: 0 24px; line-height: 1.6; }
  h1, h2, h3 { margin-top: 1.5em; }
  code { background: #f1f3f4; padding: 2px 6px; border-radius: 4px; }
  pre { background: #f1f3f4; padding: 16px; border-radius: 8px; overflow-x: auto; }`

const PRINT_STYLE = `
  * { box-sizing: border-box; }
  body { font-family: 'Segoe UI', Arial, sans-serif; font-size: 13px; line-height: 1.7; color: #1a1a1a; max-width: 720px; margin: 0 auto; padding: 48px 40px; }
  h1 { font-size: 26px; font-weight: 700; margin: 0 0 8px; color: #111; }
  h2 { font-size: 20px; font-weight: 600; margin: 28px 0 8px; color: #222; }
  h3 { font-size: 16px; font-weight: 600; margin: 20px 0 6px; color: #333; }
  p { margin: 0 0 12px; }
  ul, ol { margin: 0 0 12px; padding-left: 24px; }
  li { margin-bottom: 4px; }
  code { background: #f1f3f4; padding: 2px 5px; border-radius: 3px; font-family: 'Courier New', monospace; font-size: 12px; }
  pre { background: #f1f3f4; padding: 14px 16px; border-radius: 6px; overflow-x: auto; margin: 0 0 14px; }
  pre code { background: none; padding: 0; }
  table { width: 100%; border-collapse: collapse; margin: 0 0 14px; font-size: 12px; }
  th, td { border: 1px solid #ddd; padding: 7px 10px; text-align: left; }
  th { background: #f5f5f5; font-weight: 600; }
  blockquote { border-left: 3px solid #ddd; margin: 0 0 14px; padding: 4px 16px; color: #555; }
  .doc-title { border-bottom: 2px solid #e8e8e8; padding-bottom: 16px; margin-bottom: 28px; }
  .doc-meta { font-size: 11px; color: #888; margin-top: 4px; }`

function htmlPage(title: string, style: string, body: string): string {
  return `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <title>${title}</title>
  <style>${style}</style>
</head>
<body>
${body}
</body>
</html>`
}

export class HtmlExporter implements DocumentExporter {
  readonly format = 'html'

  async export({ title, content }: ExportableDocument): Promise<ExportResult> {
    const safeTitle = escapeHtml(title)
    return {
      contentType: 'text/html; charset=utf-8',
      body: htmlPage(safeTitle, PAGE_STYLE, `<h1>${safeTitle}</h1>\n${content}`)
    }
  }
}

export class MarkdownExporter implements DocumentExporter {
  readonly format = 'md'

  async export({ title, content }: ExportableDocument): Promise<ExportResult> {
    return {
      contentType: 'text/markdown; charset=utf-8',
      body: `# ${title}\n\n${NodeHtmlMarkdown.translate(content)}`
    }
  }
}

export class PdfExporter implements DocumentExporter {
  readonly format = 'pdf'

  constructor(private readonly renderer: PdfRenderer) {}

  async export({ title, content }: ExportableDocument): Promise<ExportResult> {
    const safeTitle = escapeHtml(title)
    const exportedAt = new Date().toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })
    const html = htmlPage(safeTitle, PRINT_STYLE, `
  <div class="doc-title">
    <h1>${safeTitle}</h1>
    <div class="doc-meta">Exporté le ${exportedAt}</div>
  </div>
  ${content}`)
    return { contentType: 'application/pdf', body: await this.renderer.render(html) }
  }
}
