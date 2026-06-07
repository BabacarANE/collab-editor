import http from 'k6/http'
import { check, sleep } from 'k6'

export const options = {
  stages: [
    { duration: '30s', target: 10 },
    { duration: '1m',  target: 20 },
    { duration: '30s', target: 0  },
  ],
  thresholds: {
    http_req_duration: ['p(95)<2000'],
    http_req_failed:   ['rate<0.05'],
  },
}

const BASE_URL = 'http://collab.local:8080'
const TEST_EMAIL = 'k6-load@test.com'
const TEST_PASSWORD = 'password123'

export function setup() {
  // Essayer register, si 409 faire login
  let authRes = http.post(`${BASE_URL}/api/auth/register`, JSON.stringify({
    email: TEST_EMAIL,
    password: TEST_PASSWORD
  }), { headers: { 'Content-Type': 'application/json' } })

  if (authRes.status === 409) {
    authRes = http.post(`${BASE_URL}/api/auth/login`, JSON.stringify({
      email: TEST_EMAIL,
      password: TEST_PASSWORD
    }), { headers: { 'Content-Type': 'application/json' } })
  }

  const token = authRes.json('accessToken')
  console.log(`Auth status: ${authRes.status}, token: ${token ? 'ok' : 'null'}`)

  const headers = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`
  }

  const wsRes = http.post(`${BASE_URL}/api/workspaces`,
    JSON.stringify({ name: 'k6-workspace' }), { headers })
  console.log(`Workspace status: ${wsRes.status}`)
  const workspaceId = wsRes.json('id')

  const docRes = http.post(`${BASE_URL}/api/documents`,
    JSON.stringify({ title: 'k6-document', workspaceId }), { headers })
  console.log(`Document status: ${docRes.status}, docId: ${docRes.json('id')}`)
  const docId = docRes.json('id')

  return { token, docId, workspaceId }
}

export default function (data) {
  const headers = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${data.token}`
  }

  const getRes = http.get(`${BASE_URL}/api/documents/${data.docId}`, { headers })
  check(getRes, { 'document lu': r => r.status === 200 })

  const listRes = http.get(`${BASE_URL}/api/documents/workspace/${data.workspaceId}`, { headers })
  check(listRes, { 'liste documents ok': r => r.status === 200 })

  sleep(1)
}