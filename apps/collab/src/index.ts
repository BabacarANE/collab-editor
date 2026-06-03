import { WebSocketServer, WebSocket } from 'ws'
import http from 'http'
import jwt from 'jsonwebtoken'
import { setupWSConnection, getYDoc } from 'y-websocket/bin/utils'
import { createClient } from 'redis'
import * as Y from 'yjs'

const PORT = Number(process.env.COLLAB_PORT) || 4000
const JWT_SECRET = process.env.JWT_SECRET ?? 'dev_secret'
const REDIS_URL = process.env.REDIS_URL ?? 'redis://redis:6379'

// ─── Redis — deux clients séparés ────────────────────────────────────────────
// Redis nécessite deux connexions distinctes :
// - publisher  : envoie les messages (ne peut pas subscribe en même temps)
// - subscriber : écoute les messages (ne peut pas publish en même temps)
const publisher  = createClient({ url: REDIS_URL })
const subscriber = createClient({ url: REDIS_URL })

// Map locale : docId → Set de WebSockets connectés sur CETTE instance
const docClients = new Map<string, Set<WebSocket>>()

async function start() {
  await publisher.connect()
  await subscriber.connect()
  console.log('[collab] Redis connecté')

  // ─── Écouter les messages des AUTRES instances ──────────────────────────
  // Quand une autre instance publie une update Yjs sur Redis,
  // on la reçoit ici et on la broadcast à nos clients locaux
  await subscriber.pSubscribe('doc:*', (message, channel) => {
    const docId = channel.replace('doc:', '')

    // Décoder l'update
    const update = Buffer.from(message, 'base64')

    // Appliquer l'update au Y.Doc local de cette instance
    // setupWSConnection se charge ensuite de broadcaster aux clients connectés localement
    const ydoc = getYDoc(docId)
    Y.applyUpdate(ydoc, update, 'redis')
  })

  // ─── Serveur HTTP ────────────────────────────────────────────────────────
  const server = http.createServer((req, res) => {
    if (req.url === '/health') {
      res.writeHead(200)
      res.end(JSON.stringify({ status: 'ok', redis: 'connected' }))
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

    // ─── Auth JWT ──────────────────────────────────────────────────────────
    if (!token) {
      ws.close(4001, 'Token manquant')
      return
    }

    try {
      jwt.verify(token, JWT_SECRET) as { userId: string }
    } catch {
      ws.close(4001, 'Token invalide')
      return
    }

    console.log(`[collab] Connexion acceptée — docId: ${docId}`)

    // ─── Enregistrer ce client dans la map locale ──────────────────────────
    if (!docClients.has(docId)) docClients.set(docId, new Set())
    docClients.get(docId)!.add(ws)

    // ─── Intercepter les updates Yjs pour les publier sur Redis ───────────
    // setupWSConnection gère la synchronisation Yjs en mémoire locale
    // On écoute le Y.Doc pour publier chaque update vers Redis
    setupWSConnection(ws, req)

    // Récupérer le Y.Doc créé par setupWSConnection pour ce docId
    const ydoc = getYDoc(docId)

    const updateHandler = (update: Uint8Array, origin: any) => {
      // origin === ws signifie que l'update vient d'un client local
      // On la publie sur Redis pour que les autres instances la reçoivent
      if (origin !== 'redis') {
        publisher.publish(`doc:${docId}`, Buffer.from(update).toString('base64'))
          .catch(err => console.error('[collab] Erreur publish Redis:', err))
      }
    }

    ydoc.on('update', updateHandler)

    // ─── Nettoyage à la déconnexion ────────────────────────────────────────
    ws.on('close', () => {
      const clients = docClients.get(docId)
      if (clients) {
        clients.delete(ws)
        if (clients.size === 0) {
          docClients.delete(docId)
          ydoc.off('update', updateHandler)
          console.log(`[collab] Plus de clients pour docId: ${docId} — nettoyage`)
        }
      }
    })

    ws.on('error', (err) => {
      console.error('[collab] Erreur WebSocket:', err.message)
    })
  })

  server.listen(PORT, () => {
    console.log(`[collab] Serveur WebSocket démarré sur le port ${PORT}`)
  })
}

// ─── Gestion des erreurs Redis ───────────────────────────────────────────────
publisher.on('error', err => console.error('[collab] Redis publisher error:', err))
subscriber.on('error', err => console.error('[collab] Redis subscriber error:', err))

start().catch(err => {
  console.error('[collab] Erreur démarrage:', err)
  process.exit(1)
})