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

const publisher  = createClient({ url: REDIS_URL })
const subscriber = createClient({ url: REDIS_URL })

const kafka = new Kafka({
  clientId: 'collab-server',
  brokers: [KAFKA_BROKER],
  retry: { retries: 3 }
})
const producer = kafka.producer()

const docClients = new Map<string, Set<WebSocket>>()

// ─── Kafka — connexion non-bloquante avec retry ──────────────────────────────
async function connectKafka(): Promise<void> {
  try {
    await producer.connect()
    console.log('[collab] Kafka producer connecté')

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
  } catch (err) {
    console.error('[collab] Kafka non disponible, retry dans 10s')
    setTimeout(() => connectKafka(), 10000)
  }
}

async function start() {
  // Redis — bloquant (critique)
  await publisher.connect()
  await subscriber.connect()
  console.log('[collab] Redis connecté')

  // Kafka — non-bloquant (le serveur WS démarre même si Kafka est down)
  connectKafka()

  // Redis Pub/Sub
  await subscriber.pSubscribe('doc:*', (message, channel) => {
    const docId = channel.replace('doc:', '')
    const update = Buffer.from(message, 'base64')
    const ydoc = getYDoc(docId)
    Y.applyUpdate(ydoc, update, 'redis')
  })

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

    if (!token) { ws.close(4001, 'Token manquant'); return }
    try {
      jwt.verify(token, JWT_SECRET)
    } catch {
      ws.close(4001, 'Token invalide'); return
    }

    console.log(`[collab] Connexion acceptée — docId: ${docId}`)

    if (!docClients.has(docId)) docClients.set(docId, new Set())
    docClients.get(docId)!.add(ws)

    setupWSConnection(ws, req)

    const ydoc = getYDoc(docId)

    const updateHandler = async (update: Uint8Array, origin: any) => {
      if (origin === 'redis') return

      publisher.publish(`doc:${docId}`, Buffer.from(update).toString('base64'))
        .catch(err => console.error('[collab] Erreur Redis publish:', err))

      try {
        await producer.send({
          topic: 'doc-operations',
          messages: [{
            key: docId,
            value: Buffer.from(update),
            headers: { docId, timestamp: Date.now().toString() }
          }]
        })
      } catch {
        console.warn('[collab] Kafka indisponible — opération non persistée')
      }
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

process.on('SIGTERM', async () => {
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