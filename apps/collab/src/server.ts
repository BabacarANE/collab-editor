import http from 'http'
import type { Duplex } from 'stream'
import { WebSocketServer, type WebSocket } from 'ws'
import { setupWSConnection } from 'y-websocket/bin/utils'
import { canWrite, type PermissionChecker } from './auth/PermissionChecker'
import { verifyAccessToken } from './auth/tokens'
import type { Metrics } from './metrics'
import { makeReadOnly, parseDocId } from './protocol'
import type { DocumentRegistry } from './sync/DocumentRegistry'

interface Dependencies {
  jwtSecret: string
  maxMessageBytes: number
  permissions: PermissionChecker
  registry: DocumentRegistry
  metrics: Metrics
}

function rejectUpgrade(socket: Duplex, status: number, message: string) {
  socket.write(`HTTP/1.1 ${status} ${message}\r\nConnection: close\r\nContent-Length: 0\r\n\r\n`)
  socket.destroy()
}

// Serveur HTTP : /health, /metrics et WebSocket authentifié par document
export function createCollabServer({ jwtSecret, maxMessageBytes, permissions, registry, metrics }: Dependencies) {
  const server = http.createServer(async (req, res) => {
    if (req.url === '/health') {
      res.writeHead(200)
      res.end(JSON.stringify({ status: 'ok' }))
      return
    }
    if (req.url === '/metrics') {
      res.writeHead(200, { 'Content-Type': metrics.registry.contentType })
      res.end(await metrics.registry.metrics())
      return
    }
    res.writeHead(404)
    res.end()
  })

  const wss = new WebSocketServer({ noServer: true, maxPayload: maxMessageBytes })

  // Authentification et autorisation AVANT d'accepter la connexion
  server.on('upgrade', async (req, socket, head) => {
    const url = new URL(req.url ?? '/', 'http://localhost')
    const docId = parseDocId(url.pathname)
    const token = url.searchParams.get('token') ?? ''

    if (!docId) return rejectUpgrade(socket, 400, 'Bad Request')

    const claims = verifyAccessToken(token, jwtSecret)
    if (!claims) return rejectUpgrade(socket, 401, 'Unauthorized')

    const role = await permissions.roleFor(docId, token)
    if (!role) return rejectUpgrade(socket, 403, 'Forbidden')

    await registry.acquire(docId)
    wss.handleUpgrade(req, socket, head, ws => {
      onConnection(ws, req, docId, canWrite(role), claims.exp)
    })
  })

  function onConnection(ws: WebSocket, req: http.IncomingMessage, docId: string, writable: boolean, exp?: number) {
    metrics.connections.inc()
    if (!writable) makeReadOnly(ws, () => metrics.rejectedWrites.inc())

    setupWSConnection(ws, req, { docName: docId })

    // À l'expiration du token, on ferme : le client se reconnecte avec un
    // token frais et ses droits sont revérifiés (permission révoquée, etc.)
    const expiryTimer = exp
      ? setTimeout(() => ws.close(4001, 'Token expiré'), Math.max(0, exp * 1000 - Date.now()))
      : undefined

    ws.on('close', () => {
      if (expiryTimer) clearTimeout(expiryTimer)
      metrics.connections.dec()
      registry.release(docId)
    })
    ws.on('error', err => console.error('[collab] Erreur WebSocket:', err.message))
  }

  return server
}
