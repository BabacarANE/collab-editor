import { WebSocketServer, WebSocket } from 'ws'
import http from 'http'
import jwt from 'jsonwebtoken'
import { setupWSConnection, getYDoc } from 'y-websocket/bin/utils'
import { createClient } from 'redis'
import { Kafka } from 'kafkajs'
import * as Y from 'yjs'
import { Registry, Gauge, Counter, Histogram, collectDefaultMetrics } from 'prom-client'

const PORT = Number(process.env.COLLAB_PORT) || 4000
const METRICS_PORT = Number(process.env.METRICS_PORT) || 9091
const JWT_SECRET = process.env.JWT_SECRET ?? 'dev_secret'
const REDIS_URL = process.env.REDIS_URL ?? 'redis://redis:6379'
const KAFKA_BROKER = process.env.KAFKA_BROKER ?? 'kafka:29092'

// ─── Métriques Prometheus ────────────────────────────────────────────────────
const registry = new Registry()
collectDefaultMetrics({ register: registry })

const wsConnections = new Gauge({
  name: 'collab_websocket_connections_active',
  help: 'Nombre de connexions WebSocket actives',
  labelNames: ['docId'],
  registers: [registry]
})

const opsTotal = new Counter({
  name: 'collab_operations_total',
  help: 'Nombre total d\'opérations Yjs reçues',
  labelNames: ['docId'],
  registers: [registry]
})

const opDuration = new Histogram({
  name: 'collab_operation_duration_seconds',
  help: 'Durée de traitement des opérations Yjs',
  buckets: [0.001, 0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5],
  registers: [registry]
})

// ─── Redis + Kafka (inchangé) ────────────────────────────────────────────────
const publisher  = createClient({ url: REDIS_URL })
const subscriber = createClient({ url: REDIS_URL })

const kafka = new Kafka({
  clientId: 'collab-server',
  brokers: [KAFKA_BROKER],
  retry: { retries: 3 }
})
const producer = kafka.producer()

const docClients = new Map<string, Set<WebSocket>>()

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
  await publisher.connect()
  await subscriber.connect()
  console.log('[collab] Redis connecté')

  connectKafka()

  await subscriber.pSubscribe('doc:*', (message, channel) => {
    const docId = channel.replace('doc:', '')
    const update = Buffer.from(message, 'base64')
    const ydoc = getYDoc(docId)
    Y.applyUpdate(ydoc, update, 'redis')
  })

  // ─── Serveur HTTP — WebSocket + /health + /metrics ──────────────────────
  const server = http.createServer(async (req, res) => {
    if (req.url === '/health') {
      res.writeHead(200)
      res.end(JSON.stringify({ status: 'ok' }))
      return
    }
    if (req.url === '/metrics') {
      res.writeHead(200, { 'Content-Type': registry.contentType })
      res.end(await registry.metrics())
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

    // ── Incrémenter les connexions actives ──
    wsConnections.inc({ docId })

    setupWSConnection(ws, req)

    const ydoc = getYDoc(docId)

    const updateHandler = async (update: Uint8Array, origin: any) => {
      if (origin === 'redis') return

      // ── Mesurer la durée de traitement ──
      const end = opDuration.startTimer()
      opsTotal.inc({ docId })

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

      end()
    }

    ydoc.on('update', updateHandler)

    ws.on('close', () => {
      // ── Décrémenter les connexions actives ──
      wsConnections.dec({ docId })

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
    console.log(`[collab] Métriques disponibles sur http://localhost:${PORT}/metrics`)
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