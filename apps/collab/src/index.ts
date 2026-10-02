import { WebSocketServer, WebSocket, RawData } from 'ws'
import http from 'http'
import { randomUUID } from 'crypto'
import { Duplex } from 'stream'
import jwt from 'jsonwebtoken'
import { setupWSConnection, getYDoc, docs } from 'y-websocket/bin/utils'
import { createClient } from 'redis'
import { Kafka } from 'kafkajs'
import * as Y from 'yjs'
import * as decoding from 'lib0/decoding'
import { Registry, Gauge, Counter, Histogram, collectDefaultMetrics } from 'prom-client'

const PORT = Number(process.env.COLLAB_PORT) || 4000
const IS_PRODUCTION = process.env.NODE_ENV === 'production'
const JWT_SECRET = process.env.JWT_SECRET ?? ''
const REDIS_URL = process.env.REDIS_URL ?? 'redis://redis:6379'
const KAFKA_BROKER = process.env.KAFKA_BROKER ?? process.env.KAFKA_BROKERS ?? 'kafka:29092'
const API_URL = process.env.API_URL ?? 'http://api:3000'
// Délai avant de libérer un document sans client local
const DOC_IDLE_TTL_MS = Number(process.env.DOC_IDLE_TTL_MS) || 30_000
// Attente maximale de l'état des autres instances au chargement d'un document
const PEER_SYNC_TIMEOUT_MS = 500
const MAX_MESSAGE_BYTES = 5 * 1024 * 1024
const INSTANCE_ID = randomUUID()

if (JWT_SECRET.length < 32 && IS_PRODUCTION) {
  throw new Error('JWT_SECRET doit être défini (32 caractères minimum) en production')
}
const jwtSecret = JWT_SECRET || 'dev_secret_do_not_use_in_production_0000'

type DocumentRole = 'OWNER' | 'EDITOR' | 'COMMENTER' | 'VIEWER'
const WRITE_ROLES: DocumentRole[] = ['OWNER', 'EDITOR']

// Protocole y-websocket : type de message puis sous-type sync
const MESSAGE_SYNC = 0
const SYNC_STEP2 = 1
const SYNC_UPDATE = 2

// ─── Métriques Prometheus ────────────────────────────────────────────────────
// Pas de label docId : une série par document ferait exploser la cardinalité
const registry = new Registry()
collectDefaultMetrics({ register: registry })

const wsConnections = new Gauge({
  name: 'collab_websocket_connections_active',
  help: 'Nombre de connexions WebSocket actives',
  registers: [registry]
})

const docsLoaded = new Gauge({
  name: 'collab_documents_loaded',
  help: 'Nombre de documents chargés en mémoire',
  registers: [registry],
  collect() { this.set(docs.size) }
})

const opsTotal = new Counter({
  name: 'collab_operations_total',
  help: 'Nombre total d\'opérations Yjs reçues',
  registers: [registry]
})

const rejectedWrites = new Counter({
  name: 'collab_rejected_writes_total',
  help: 'Écritures refusées (utilisateur en lecture seule)',
  registers: [registry]
})

const opDuration = new Histogram({
  name: 'collab_operation_duration_seconds',
  help: 'Durée de traitement des opérations Yjs',
  buckets: [0.001, 0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5],
  registers: [registry]
})

// ─── Redis + Kafka ───────────────────────────────────────────────────────────
const publisher  = createClient({ url: REDIS_URL })
const subscriber = createClient({ url: REDIS_URL })

const kafka = new Kafka({
  clientId: 'collab-server',
  brokers: [KAFKA_BROKER],
  retry: { retries: 3 }
})
const producer = kafka.producer()

// Connexions locales par document et handler unique par document
const docClients = new Map<string, Set<WebSocket>>()
const docUpdateHandlers = new Map<string, (update: Uint8Array, origin: unknown) => void>()
const docReleaseTimers = new Map<string, NodeJS.Timeout>()
const peerSyncWaiters = new Map<string, () => void>()

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
  } catch {
    console.error('[collab] Kafka non disponible, retry dans 10s')
    setTimeout(() => connectKafka(), 10000)
  }
}

// ─── Authentification et autorisation ────────────────────────────────────────

// Le chemin peut être préfixé par /ws (ingress Kubernetes)
function parseDocId(pathname: string): string | null {
  const raw = pathname.replace(/^\/ws(?=\/)/, '').replace(/^\//, '')
  let docId: string
  try { docId = decodeURIComponent(raw) } catch { return null }
  return /^[A-Za-z0-9_-]{1,64}$/.test(docId) ? docId : null
}

function verifyAccessToken(token: string): { userId: string; exp?: number } | null {
  try {
    const payload = jwt.verify(token, jwtSecret) as { userId?: string; type?: string; exp?: number }
    if (!payload.userId || payload.type === 'refresh') return null
    return { userId: payload.userId, exp: payload.exp }
  } catch {
    return null
  }
}

// L'API reste la seule source de vérité sur les permissions
async function fetchDocumentRole(docId: string, token: string): Promise<DocumentRole | null> {
  try {
    const res = await fetch(`${API_URL}/api/documents/${encodeURIComponent(docId)}/my-role`, {
      headers: { authorization: `Bearer ${token}` },
      signal: AbortSignal.timeout(5000)
    })
    if (!res.ok) return null
    const body = await res.json() as { role?: DocumentRole }
    return body.role ?? null
  } catch (err) {
    console.error('[collab] Vérification des droits impossible:', (err as Error).message)
    return null
  }
}

function rejectUpgrade(socket: Duplex, status: number, message: string) {
  socket.write(`HTTP/1.1 ${status} ${message}\r\nConnection: close\r\nContent-Length: 0\r\n\r\n`)
  socket.destroy()
}

// Un message client modifie le document s'il s'agit d'un sync step 2 ou d'un update
function isWriteMessage(data: RawData): boolean {
  try {
    const buffer = Array.isArray(data) ? Buffer.concat(data) : Buffer.from(data as ArrayBuffer)
    const decoder = decoding.createDecoder(new Uint8Array(buffer))
    if (decoding.readVarUint(decoder) !== MESSAGE_SYNC) return false
    const syncType = decoding.readVarUint(decoder)
    return syncType === SYNC_STEP2 || syncType === SYNC_UPDATE
  } catch {
    return true
  }
}

// Filtre les écritures d'un client en lecture seule avant y-websocket
function makeReadOnly(ws: WebSocket) {
  const originalEmit = ws.emit.bind(ws)
  ws.emit = ((event: string | symbol, ...args: unknown[]) => {
    if (event === 'message' && isWriteMessage(args[0] as RawData)) {
      rejectedWrites.inc()
      return false
    }
    return originalEmit(event, ...args)
  }) as typeof ws.emit
}

// ─── Cycle de vie des documents ──────────────────────────────────────────────

// Charge le document localement et attache UN SEUL handler de diffusion
async function ensureDocLoaded(docId: string): Promise<void> {
  const pendingRelease = docReleaseTimers.get(docId)
  if (pendingRelease) {
    clearTimeout(pendingRelease)
    docReleaseTimers.delete(docId)
  }
  if (docUpdateHandlers.has(docId)) return

  const ydoc = getYDoc(docId)
  const handler = (update: Uint8Array, origin: unknown) => {
    if (origin === 'redis') return

    const end = opDuration.startTimer()
    opsTotal.inc()

    publisher.publish(`doc:${docId}`, Buffer.from(update).toString('base64'))
      .catch(err => console.error('[collab] Erreur Redis publish:', err))

    producer.send({
      topic: 'doc-operations',
      messages: [{
        key: docId,
        value: Buffer.from(update),
        headers: { docId, timestamp: Date.now().toString() }
      }]
    })
      .catch(() => console.warn('[collab] Kafka indisponible — opération non persistée'))
      .finally(() => end())
  }
  ydoc.on('update', handler)
  docUpdateHandlers.set(docId, handler)

  await requestPeerState(docId)
}

// Demande l'état courant aux autres instances qui ont déjà ce document
async function requestPeerState(docId: string): Promise<void> {
  try {
    const receivers = await publisher.publish('doc-sync-request', `${INSTANCE_ID}:${docId}`)
    // receivers inclut cette instance : rien à attendre si elle est seule
    if (receivers <= 1) return
    await new Promise<void>(resolve => {
      const timer = setTimeout(() => { peerSyncWaiters.delete(docId); resolve() }, PEER_SYNC_TIMEOUT_MS)
      peerSyncWaiters.set(docId, () => { clearTimeout(timer); peerSyncWaiters.delete(docId); resolve() })
    })
  } catch (err) {
    console.error('[collab] Synchronisation inter-instances impossible:', err)
  }
}

function scheduleDocRelease(docId: string) {
  const timer = setTimeout(() => {
    docReleaseTimers.delete(docId)
    if (docClients.has(docId)) return
    const ydoc = docs.get(docId)
    const handler = docUpdateHandlers.get(docId)
    if (ydoc && handler) ydoc.off('update', handler)
    docUpdateHandlers.delete(docId)
    if (ydoc) {
      docs.delete(docId)
      ydoc.destroy()
    }
    console.log(`[collab] Document libéré: ${docId}`)
  }, DOC_IDLE_TTL_MS)
  docReleaseTimers.set(docId, timer)
}

// ─── Démarrage ───────────────────────────────────────────────────────────────
async function start() {
  await publisher.connect()
  await subscriber.connect()
  console.log('[collab] Redis connecté')

  connectKafka()

  // Mises à jour des autres instances : appliquées seulement aux documents
  // chargés ici (sinon chaque instance garderait tous les documents en mémoire)
  await subscriber.pSubscribe('doc:*', (message, channel) => {
    const docId = channel.slice('doc:'.length)
    const ydoc = docs.get(docId)
    if (!ydoc) return
    Y.applyUpdate(ydoc, Buffer.from(message, 'base64'), 'redis')
    peerSyncWaiters.get(docId)?.()
  })

  // Une autre instance charge un document : on lui envoie notre état complet
  await subscriber.subscribe('doc-sync-request', message => {
    const [requester, docId] = message.split(':')
    if (requester === INSTANCE_ID) return
    const ydoc = docs.get(docId)
    if (!ydoc) return
    const state = Buffer.from(Y.encodeStateAsUpdate(ydoc)).toString('base64')
    publisher.publish(`doc:${docId}`, state)
      .catch(err => console.error('[collab] Erreur Redis publish:', err))
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

  const wss = new WebSocketServer({ noServer: true, maxPayload: MAX_MESSAGE_BYTES })

  // Authentification et autorisation AVANT d'accepter la connexion
  server.on('upgrade', async (req, socket, head) => {
    const url = new URL(req.url ?? '/', 'http://localhost')
    const docId = parseDocId(url.pathname)
    const token = url.searchParams.get('token') ?? ''

    if (!docId) return rejectUpgrade(socket, 400, 'Bad Request')

    const claims = verifyAccessToken(token)
    if (!claims) return rejectUpgrade(socket, 401, 'Unauthorized')

    const role = await fetchDocumentRole(docId, token)
    if (!role) return rejectUpgrade(socket, 403, 'Forbidden')

    await ensureDocLoaded(docId)

    wss.handleUpgrade(req, socket, head, ws => onConnection(ws, req, docId, role, claims.exp))
  })

  function onConnection(ws: WebSocket, req: http.IncomingMessage, docId: string, role: DocumentRole, exp?: number) {
    if (!docClients.has(docId)) docClients.set(docId, new Set())
    docClients.get(docId)!.add(ws)
    wsConnections.inc()

    if (!WRITE_ROLES.includes(role)) makeReadOnly(ws)

    setupWSConnection(ws, req, { docName: docId })

    // À l'expiration du token, on ferme : le client se reconnecte avec un
    // token frais et ses droits sont revérifiés (permission révoquée, etc.)
    const expiryTimer = exp
      ? setTimeout(() => ws.close(4001, 'Token expiré'), Math.max(0, exp * 1000 - Date.now()))
      : undefined

    ws.on('close', () => {
      if (expiryTimer) clearTimeout(expiryTimer)
      wsConnections.dec()

      const clients = docClients.get(docId)
      if (!clients) return
      clients.delete(ws)
      if (clients.size === 0) {
        docClients.delete(docId)
        scheduleDocRelease(docId)
      }
    })

    ws.on('error', err => console.error('[collab] Erreur WebSocket:', err.message))
  }

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
