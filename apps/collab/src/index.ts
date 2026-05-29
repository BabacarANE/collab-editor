import { WebSocketServer, WebSocket } from 'ws'
import http from 'http'
import jwt from 'jsonwebtoken'
import { setupWSConnection } from 'y-websocket/bin/utils'

const PORT = Number(process.env.COLLAB_PORT) || 4000
const JWT_SECRET = process.env.JWT_SECRET ?? 'dev_secret'

// Créer un serveur HTTP de base (requis par ws)
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
  // Extraire le token JWT depuis l'URL
  // Le client se connectera avec : ws://localhost:4000/?token=xxx&docId=yyy
  const url = new URL(req.url ?? '/', `http://localhost:${PORT}`)
  const token = url.searchParams.get('token')
  const docId = url.searchParams.get('docId')

  // Vérifier le JWT
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

  // Déléguer à y-websocket qui gère les rooms Yjs automatiquement
  // Le docId devient le nom de la room
  setupWSConnection(ws, req)
})

server.listen(PORT, () => {
  console.log(`[collab] Serveur WebSocket démarré sur le port ${PORT}`)
})