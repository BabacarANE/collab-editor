import jwt from 'jsonwebtoken'

export interface AccessClaims {
  userId: string
  exp?: number
}

// Seuls les access tokens sont acceptés (un refresh token est refusé)
export function verifyAccessToken(token: string, secret: string): AccessClaims | null {
  try {
    const payload = jwt.verify(token, secret) as { userId?: string; type?: string; exp?: number }
    if (!payload.userId || payload.type === 'refresh') return null
    return { userId: payload.userId, exp: payload.exp }
  } catch {
    return null
  }
}
