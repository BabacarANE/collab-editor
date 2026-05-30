import { WebSocketServer, WebSocket } from 'ws'
import http from 'http'
import jwt from 'jsonwebtoken'
import { setupWSConnection } from 'y-websocket/bin/utils'

const PORT = Number(process.env.COLLAB_PORT) || 4000
const JWT_SECRET = process.env.JWT_SECRET ?? 'dev_secret'

const server = http.createServer((req, res) => {
  if (req.url === '/health') {
    res.writeHead(200)
    res.end(JSON.stringify({ status: 'ok' }))
    return
  }
  res.writeHead(404)
  res.end()
})

const wss = new WebSocketServer({ server })

wss.on('connection', (ws: WebSocket, req: http.IncomingMessage) => {
  const url = new URL(req.url ?? '/', `http://localhost:${PORT}`)
  const token = url.searchParams.get('token')
  const docId = url.pathname.slice(1)

  if (!token) {
    console.log('[collab] Connexion refusée — token manquant')
    ws.close(4001, 'Token manquant')
    return
  }

  try {
    const payload = jwt.verify(token, JWT_SECRET) as { userId: string }
    console.log(`[collab] Connexion acceptée — userId: ${payload.userId}, docId: ${docId}`)
  } catch {
    console.log('[collab] Connexion refusée — token invalide')
    ws.close(4001, 'Token invalide')
    return
  }

  // Écouter les erreurs sur le socket
  ws.on('error', (err) => {
    console.error('[collab] Erreur WebSocket:', err.message)
  })

  ws.on('close', (code, reason) => {
    console.log(`[collab] Connexion fermée — code: ${code}, raison: ${reason.toString()}`)
  })

  try {
    setupWSConnection(ws, req)
    console.log('[collab] setupWSConnection OK pour docId:', docId)
  } catch (err: any) {
    console.error('[collab] Erreur setupWSConnection:', err.message)
  }
})

server.listen(PORT, () => {
  console.log(`[collab] Serveur WebSocket démarré sur le port ${PORT}`)
})