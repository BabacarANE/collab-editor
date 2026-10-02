// Configuration centralisée — lue une seule fois au démarrage
const isProduction = process.env.NODE_ENV === 'production'

function requireSecret(name: string, devFallback: string): string {
  const value = process.env[name]
  if (value && value.length >= 32) return value
  if (isProduction) {
    throw new Error(`${name} doit être défini (32 caractères minimum) en production`)
  }
  return value ?? devFallback
}

export const config = {
  isProduction,
  port: Number(process.env.PORT) || 3000,
  jwtSecret: requireSecret('JWT_SECRET', 'dev_secret_do_not_use_in_production_0000'),
  corsOrigins: (process.env.CORS_ORIGINS ?? 'http://localhost:5173,http://localhost:5174')
    .split(',')
    .map(o => o.trim())
    .filter(Boolean),
  accessTokenTtl: '15m',
  refreshTokenTtlMs: 7 * 24 * 60 * 60 * 1000
}
