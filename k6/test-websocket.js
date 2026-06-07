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
const DOC_ID    = 'k6-load-test-doc'

export function setup() {
  const res = http.post(`${BASE_URL}/api/auth/register`, JSON.stringify({
    email: `k6-ws-${Date.now()}@test.com`,
    password: 'password123'
  }), { headers: { 'Content-Type': 'application/json' } })

  check(res, { 'auth ok': r => r.status === 201 })
  return { token: res.json('accessToken') }
}

export default function (data) {
  const url = `${WS_URL}/${DOC_ID}?token=${data.token}`

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