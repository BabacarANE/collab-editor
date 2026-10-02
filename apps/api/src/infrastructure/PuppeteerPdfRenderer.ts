import type { PdfRenderer } from '../services/ports'

const RENDER_TIMEOUT_MS = 15_000

// Rendu PDF par Chromium headless, sans réseau ni JavaScript : empêche toute
// SSRF (services internes, metadata cloud, file://) via le contenu
export class PuppeteerPdfRenderer implements PdfRenderer {
  async render(html: string): Promise<Buffer> {
    const puppeteer = await import('puppeteer')
    const browser = await puppeteer.default.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--disable-gpu']
    })
    try {
      const page = await browser.newPage()
      await page.setJavaScriptEnabled(false)
      await page.setRequestInterception(true)
      page.on('request', req => {
        const url = req.url()
        if (url.startsWith('data:') || url === 'about:blank') req.continue()
        else req.abort()
      })
      await page.setContent(html, { waitUntil: 'load', timeout: RENDER_TIMEOUT_MS })
      const pdf = await page.pdf({
        format: 'A4',
        margin: { top: '20mm', bottom: '20mm', left: '15mm', right: '15mm' },
        printBackground: true
      })
      return Buffer.from(pdf)
    } finally {
      await browser.close()
    }
  }
}
