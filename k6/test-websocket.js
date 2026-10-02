import ws from 'k6/ws'
import http from 'k6/http'
import { check, sleep } from 'k6'

export const options = {
  stages: [
    { duration: '20s', target: 5  },  // montée à 5 connexions WS
    { duration: '1m',  target: 20 },  // maintien à 20 connexions
    { duration: '20s', target: 0  },  // descente
  ],
  thresholds: {
    ws_connecting:          ['p(95)<1000'],  // connexion WS < 1s
    ws_session_duration:    ['p(95)<70000'], // session < 70s
  },
}

const BASE_URL  = 'http://collab.local:8080'
const WS_URL    = 'ws://collab.local:8080/ws'

// Le serveur collab vérifie les droits sur le document : on crée un
// workspace et un document dont l'utilisateur de test est propriétaire
export function setup() {
  const json = { 'Content-Type': 'application/json' }
  const res = http.post(`${BASE_URL}/api/auth/register`, JSON.stringify({
    email: `k6-ws-${Date.now()}@test.com`,
    password: 'password123'
  }), { headers: json })
  check(res, { 'auth ok': r => r.status === 201 })

  const token = res.json('accessToken')
  const headers = { ...json, Authorization: `Bearer ${token}` }
  const workspaceId = http.post(`${BASE_URL}/api/workspaces`, JSON.stringify({ name: 'k6-ws' }), { headers }).json('id')
  const docId = http.post(`${BASE_URL}/api/documents`, JSON.stringify({ title: 'k6-ws-doc', workspaceId }), { headers }).json('id')
  check(docId, { 'document créé': id => !!id })

  // Access token valide 15 min : suffisant pour ce scénario de 1 min 40
  return { token, docId }
}

export default function (data) {
  const url = `${WS_URL}/${data.docId}?token=${data.token}`

  const res = ws.connect(url, {}, function (socket) {
    socket.on('open', () => {
      console.log(`VU ${__VU} connecté`)

      // Simuler des opérations Yjs toutes les 2s
      let ops = 0
      const interval = socket.setInterval(() => {
        if (ops >= 10) {
          socket.clearInterval(interval)
          socket.close()
          return
        }
        // Envoyer un message binaire simulant une update Yjs
        const fakeUpdate = new Uint8Array([0, 0, ops, __VU, 1, 2, 3, 4])
        socket.sendBinary(fakeUpdate.buffer)
        ops++
      }, 2000)
    })

    socket.on('message', (data) => {
      // Messages reçus du serveur (broadcasts)
    })

    socket.on('error', (e) => {
      console.error(`VU ${__VU} erreur WS:`, e)
    })
  })

  check(res, { 'connexion WS ok': r => r && r.status === 101 })
  sleep(1)
}