// Configuration centralisée — lue une seule fois au démarrage
const isProduction = process.env.NODE_ENV === 'production'

function required(name: string, devFallback: string, minLength = 1): string {
  const value = process.env[name]
  if (value && value.length >= minLength) return value
  if (isProduction) {
    throw new Error(`${name} doit être défini${minLength > 1 ? ` (${minLength} caractères minimum)` : ''} en production`)
  }
  return value || devFallback
}

export const config = {
  isProduction,
  port: Number(process.env.PORT) || 3000,
  databaseUrl: required('DATABASE_URL', 'postgresql://collabuser:collabpass123@127.0.0.1:5432/collab'),
  jwtSecret: required('JWT_SECRET', 'dev_secret_do_not_use_in_production_0000', 32),
  corsOrigins: (process.env.CORS_ORIGINS ?? 'http://localhost:5173,http://localhost:5174')
    .split(',')
    .map(o => o.trim())
    .filter(Boolean),
  authRateLimitMax: Number(process.env.AUTH_RATE_LIMIT_MAX) || 10,
  accessTokenTtl: '15m',
  refreshTokenTtlMs: 7 * 24 * 60 * 60 * 1000,
  uploadMaxBytes: 10 * 1024 * 1024
}
