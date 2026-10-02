const isProduction = process.env.NODE_ENV === 'production'
const jwtSecret = process.env.JWT_SECRET ?? ''

if (jwtSecret.length < 32 && isProduction) {
  throw new Error('JWT_SECRET doit être défini (32 caractères minimum) en production')
}

export const config = {
  port: Number(process.env.COLLAB_PORT) || 4000,
  jwtSecret: jwtSecret || 'dev_secret_do_not_use_in_production_0000',
  redisUrl: process.env.REDIS_URL ?? 'redis://redis:6379',
  kafkaBroker: process.env.KAFKA_BROKER ?? process.env.KAFKA_BROKERS ?? 'kafka:29092',
  apiUrl: process.env.API_URL ?? 'http://api:3000',
  // Délai avant de libérer un document sans client local
  docIdleTtlMs: Number(process.env.DOC_IDLE_TTL_MS) || 30_000,
  // Attente maximale de l'état des autres instances au chargement d'un document
  peerSyncTimeoutMs: 500,
  maxMessageBytes: 5 * 1024 * 1024
}
