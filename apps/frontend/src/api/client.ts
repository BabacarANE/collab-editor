import axios, { type AxiosError, type InternalAxiosRequestConfig } from 'axios'
import { useAuthStore } from '../store/authStore'

const baseURL = import.meta.env.VITE_API_URL ?? 'http://localhost:3000'

export const api = axios.create({ baseURL })

// Instance sans intercepteur dédiée au refresh : un 401 sur /refresh ne
// doit jamais redéclencher un refresh (blocage infini sinon)
const authClient = axios.create({ baseURL })

// Injecter l'access token sur chaque requête
api.interceptors.request.use((config) => {
  const token = useAuthStore.getState().accessToken
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

// Un seul refresh à la fois : les appels concurrents partagent la même promesse
let refreshPromise: Promise<string> | null = null

export function refreshAccessToken(): Promise<string> {
  if (refreshPromise) return refreshPromise

  refreshPromise = (async () => {
    const { refreshToken, user, setAuth, logout } = useAuthStore.getState()
    if (!refreshToken || !user) {
      logout()
      throw new Error('Session expirée')
    }
    try {
      const res = await authClient.post('/api/auth/refresh', { refreshToken })
      const { accessToken, refreshToken: newRefresh } = res.data
      setAuth(user, accessToken, newRefresh)
      return accessToken as string
    } catch (err) {
      logout()
      throw err
    }
  })().finally(() => { refreshPromise = null })

  return refreshPromise
}

function tokenExpiresAt(token: string): number {
  try {
    const payload = JSON.parse(atob(token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')))
    return typeof payload.exp === 'number' ? payload.exp * 1000 : 0
  } catch {
    return 0
  }
}

// Access token valide au moins 30 s (utilisé pour la connexion WebSocket)
export async function getFreshAccessToken(): Promise<string> {
  const token = useAuthStore.getState().accessToken
  if (token && tokenExpiresAt(token) - Date.now() > 30_000) return token
  return refreshAccessToken()
}

// Refresh automatique sur 401, une seule tentative par requête
api.interceptors.response.use(
  res => res,
  async (error: AxiosError) => {
    const originalRequest = error.config as (InternalAxiosRequestConfig & { _retry?: boolean }) | undefined

    if (error.response?.status !== 401 || !originalRequest || originalRequest._retry) {
      return Promise.reject(error)
    }

    originalRequest._retry = true
    const token = await refreshAccessToken()
    originalRequest.headers.Authorization = `Bearer ${token}`
    return api(originalRequest)
  }
)
