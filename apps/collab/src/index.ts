import { WebSocketServer, WebSocket } from 'ws'
import http from 'http'
import jwt from 'jsonwebtoken'
import { setupWSConnection, getYDoc } from 'y-websocket/bin/utils'
import { createClient } from 'redis'
import { Kafka } from 'kafkajs'
import * as Y from 'yjs'

const PORT = Number(process.env.COLLAB_PORT) || 4000
const JWT_SECRET = process.env.JWT_SECRET ?? 'dev_secret'
const REDIS_URL = process.env.REDIS_URL ?? 'redis://redis:6379'
const KAFKA_BROKER = process.env.KAFKA_BROKER ?? 'kafka:29092'

// ─── Redis ───────────────────────────────────────────────────────────────────
const publisher  = createClient({ url: REDIS_URL })
const subscriber = createClient({ url: REDIS_URL })

// ─── Kafka Producer ──────────────────────────────────────────────────────────
// Le producer publie chaque update Yjs dans le topic 'doc-operations'
// kafkajs gère la connexion, les retries et le batching automatiquement
const kafka = new Kafka({
  clientId: 'collab-server',
  brokers: [KAFKA_BROKER],
  retry: { retries: 5 }
})
const producer = kafka.producer()

// Map locale : docId → Set de WebSockets connectés sur CETTE instance
const docClients = new Map<string, Set<WebSocket>>()

async function start() {
  // Connexions Redis
  await publisher.connect()
  await subscriber.connect()
  console.log('[collab] Redis connecté')

  // Connexion Kafka producer
  await producer.connect()
  console.log('[collab] Kafka producer connecté')

  // Créer le topic si nécessaire
  const admin = kafka.admin()
  await admin.connect()
  const topics = await admin.listTopics()
  if (!topics.includes('doc-operations')) {
    await admin.createTopics({
      topics: [{ topic: 'doc-operations', numPartitions: 3, replicationFactor: 1 }]
    })
    console.log('[collab] Topic doc-operations créé')
  }
  await admin.disconnect()

  // ─── Redis Pub/Sub — sync inter-instances ────────────────────────────────
  await subscriber.pSubscribe('doc:*', (message, channel) => {
    const docId = channel.replace('doc:', '')
    const update = Buffer.from(message, 'base64')
    const ydoc = getYDoc(docId)
    Y.applyUpdate(ydoc, update, 'redis')
  })

  // ─── Serveur HTTP ────────────────────────────────────────────────────────
  const server = http.createServer((req, res) => {
    if (req.url === '/health') {
      res.writeHead(200)
      res.end(JSON.stringify({ status: 'ok', redis: 'connected', kafka: 'connected' }))
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

    // Auth JWT
    if (!token) { ws.close(4001, 'Token manquant'); return }
    try {
      jwt.verify(token, JWT_SECRET)
    } catch {
      ws.close(4001, 'Token invalide'); return
    }

    console.log(`[collab] Connexion acceptée — docId: ${docId}`)

    // Enregistrer le client localement
    if (!docClients.has(docId)) docClients.set(docId, new Set())
    docClients.get(docId)!.add(ws)

    setupWSConnection(ws, req)

    const ydoc = getYDoc(docId)

    const updateHandler = async (update: Uint8Array, origin: any) => {
      if (origin === 'redis') return

      // 1. Publier sur Redis pour les autres instances collab
      publisher.publish(`doc:${docId}`, Buffer.from(update).toString('base64'))
        .catch(err => console.error('[collab] Erreur Redis publish:', err))

      // 2. Publier sur Kafka pour la persistence
      // La clé est le docId — Kafka garantit l'ordre des messages par clé
      producer.send({
        topic: 'doc-operations',
        messages: [{
          key: docId,
          value: Buffer.from(update),
          headers: {
            docId,
            timestamp: Date.now().toString()
          }
        }]
      }).catch(err => console.error('[collab] Erreur Kafka publish:', err))
    }

    ydoc.on('update', updateHandler)

    ws.on('close', () => {
      const clients = docClients.get(docId)
      if (clients) {
        clients.delete(ws)
        if (clients.size === 0) {
          docClients.delete(docId)
          ydoc.off('update', updateHandler)
          console.log(`[collab] Nettoyage docId: ${docId}`)
        }
      }
    })

    ws.on('error', err => console.error('[collab] Erreur WebSocket:', err.message))
  })

  server.listen(PORT, () => {
    console.log(`[collab] Serveur WebSocket démarré sur le port ${PORT}`)
  })
}

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('[collab] Arrêt graceful...')
  await producer.disconnect()
  await publisher.disconnect()
  await subscriber.disconnect()
  process.exit(0)
})

publisher.on('error', err => console.error('[collab] Redis publisher error:', err))
subscriber.on('error', err => console.error('[collab] Redis subscriber error:', err))

start().catch(err => {
  console.error('[collab] Erreur démarrage:', err)
  process.exit(1)
})