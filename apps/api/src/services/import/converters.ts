import mammoth from 'mammoth'
import { marked } from 'marked'
import { escapeHtml } from '../../infrastructure/html'
import type { ConvertedDocument, DocumentConverter } from './DocumentConverter'

export class MarkdownConverter implements DocumentConverter {
  readonly extensions = ['md', 'markdown'] as const

  async convert(buffer: Buffer, fallbackTitle: string): Promise<ConvertedDocument> {
    const markdown = buffer.toString('utf-8')
    const firstH1 = markdown.match(/^#\s+(.+)$/m)
    return { title: firstH1 ? firstH1[1].trim() : fallbackTitle, html: await marked.parse(markdown) }
  }
}

export class DocxConverter implements DocumentConverter {
  readonly extensions = ['docx'] as const

  async convert(buffer: Buffer, fallbackTitle: string): Promise<ConvertedDocument> {
    const { value: html } = await mammoth.convertToHtml({ buffer })
    const firstH1 = html.match(/<h1[^>]*>(.*?)<\/h1>/i)
    return { title: firstH1 ? firstH1[1].replace(/<[^>]+>/g, '').trim() : fallbackTitle, html }
  }
}

export class TextConverter implements DocumentConverter {
  readonly extensions = ['txt'] as const

  async convert(buffer: Buffer, fallbackTitle: string): Promise<ConvertedDocument> {
    const html = buffer.toString('utf-8')
      .split('\n')
      .map(line => line.trim())
      .filter(line => line.length > 0)
      .map(line => `<p>${escapeHtml(line)}</p>`)
      .join('\n')
    return { title: fallbackTitle, html }
  }
}
