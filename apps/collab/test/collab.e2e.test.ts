// Test de bout en bout du serveur collab.
// Prérequis : API (API_URL), Redis et deux instances collab démarrées
// (COLLAB_URL_A / COLLAB_URL_B). Lancement : pnpm --filter @collab/collab test:e2e
import { after, before, test } from 'node:test'
import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import WebSocket from 'ws'
import * as Y from 'yjs'
import { WebsocketProvider } from 'y-websocket'

const API_URL = process.env.API_URL ?? 'http://localhost:3000'
const COLLAB_A = process.env.COLLAB_URL_A ?? 'ws://localhost:4000'
const COLLAB_B = process.env.COLLAB_URL_B ?? 'ws://localhost:4001'

interface User { email: string; accessToken: string; refreshToken: string }

async function api(path: string, init: { method?: string; token?: string; body?: unknown } = {}) {
  const res = await fetch(`${API_URL}${path}`, {
    method: init.method ?? 'GET',
    headers: {
      'content-type': 'application/json',
      ...(init.token ? { authorization: `Bearer ${init.token}` } : {})
    },
    body: init.body ? JSON.stringify(init.body) : undefined
  })
  return { status: res.status, body: await res.json().catch(() => null) }
}

async function register(): Promise<User> {
  const email = `e2e-${randomUUID()}@example.com`
  const res = await api('/api/auth/register', { method: 'POST', body: { email, password: 'motdepasse-solide' } })
  assert.equal(res.status, 201)
  return { email, accessToken: res.body.accessToken, refreshToken: res.body.refreshToken }
}

const providers: WebsocketProvider[] = []

function connect(serverUrl: string, docId: string, token: string) {
  const ydoc = new Y.Doc()
  const provider = new WebsocketProvider(serverUrl, docId, ydoc, {
    WebSocketPolyfill: WebSocket as unknown as typeof globalThis.WebSocket,
    params: { token },
    maxBackoffTime: 200
  })
  providers.push(provider)
  return { ydoc, provider }
}

function waitSynced(provider: WebsocketProvider, timeoutMs = 3000) {
  return new Promise<void>((resolve, reject) => {
    if (provider.synced) return resolve()
    const timer = setTimeout(() => reject(new Error('sync timeout')), timeoutMs)
    provider.once('synced', () => { clearTimeout(timer); resolve() })
  })
}

// Tentative de connexion brute : renvoie le code HTTP du refus éventuel
function rawConnect(url: string): Promise<number> {
  return new Promise(resolve => {
    const ws = new WebSocket(url)
    ws.on('open', () => { ws.close(); resolve(101) })
    ws.on('unexpected-response', (_req, res) => resolve(res.statusCode ?? 0))
    ws.on('error', () => resolve(0))
  })
}

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms))

let owner: User
let viewer: User
let stranger: User
let docId: string

before(async () => {
  owner = await register()
  viewer = await register()
  stranger = await register()
  const ws = await api('/api/workspaces', { method: 'POST', token: owner.accessToken, body: { name: 'e2e' } })
  const doc = await api('/api/documents', { method: 'POST', token: owner.accessToken, body: { workspaceId: ws.body.id } })
  docId = doc.body.id
  const perm = await api(`/api/documents/${docId}/permissions`, {
    method: 'POST', token: owner.accessToken, body: { email: viewer.email, role: 'VIEWER' }
  })
  assert.equal(perm.status, 201)
})

after(() => {
  for (const p of providers) {
    p.destroy()
    p.awareness.destroy()
    p.doc.destroy()
  }
})

test('connexion refusée sans token, avec refresh token ou sans droit', async () => {
  assert.equal(await rawConnect(`${COLLAB_A}/${docId}`), 401)
  assert.equal(await rawConnect(`${COLLAB_A}/${docId}?token=${owner.refreshToken}`), 401)
  assert.equal(await rawConnect(`${COLLAB_A}/${docId}?token=${stranger.accessToken}`), 403)
  assert.equal(await rawConnect(`${COLLAB_A}/${docId}?token=${owner.accessToken}`), 101)
})

test('synchronisation entre deux instances et lecture seule du VIEWER', async () => {
  const a = connect(COLLAB_A, docId, owner.accessToken)
  await waitSynced(a.provider)
  a.ydoc.getText('t').insert(0, 'bonjour')

  // Le viewer se connecte sur l'autre instance : il reçoit l'état existant
  const b = connect(COLLAB_B, docId, viewer.accessToken)
  await waitSynced(b.provider)
  await sleep(300)
  assert.equal(b.ydoc.getText('t').toString(), 'bonjour')

  // Les modifications du propriétaire arrivent en direct
  a.ydoc.getText('t').insert(7, ' monde')
  await sleep(300)
  assert.equal(b.ydoc.getText('t').toString(), 'bonjour monde')

  // Les modifications du viewer sont ignorées par le serveur
  b.ydoc.getText('t').insert(0, 'PIRATE ')
  await sleep(300)
  assert.equal(a.ydoc.getText('t').toString(), 'bonjour monde')

  // Un nouveau client ne reçoit pas non plus l'écriture du viewer
  const c = connect(COLLAB_A, docId, owner.accessToken)
  await waitSynced(c.provider)
  await sleep(200)
  assert.equal(c.ydoc.getText('t').toString(), 'bonjour monde')
})
