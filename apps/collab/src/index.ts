import { ApiPermissionChecker } from './auth/PermissionChecker'
import { config } from './config'
import { createMetrics } from './metrics'
import { createCollabServer } from './server'
import { DocumentRegistry } from './sync/DocumentRegistry'
import { KafkaOperationLog } from './sync/KafkaOperationLog'
import { RedisUpdateBus } from './sync/RedisUpdateBus'

// Racine de composition du service collab
async function main() {
  const redis = new RedisUpdateBus(config.redisUrl)
  const kafka = new KafkaOperationLog(config.kafkaBroker)

  let registry: DocumentRegistry | null = null
  const metrics = createMetrics(() => registry?.loadedCount ?? 0)
  registry = new DocumentRegistry({
    sinks: [redis, kafka],
    idleTtlMs: config.docIdleTtlMs,
    metrics,
    fetchPeerState: docId => redis.requestState(docId, config.peerSyncTimeoutMs)
  })

  await redis.connect(registry)
  kafka.connect()

  const server = createCollabServer({
    jwtSecret: config.jwtSecret,
    maxMessageBytes: config.maxMessageBytes,
    permissions: new ApiPermissionChecker(config.apiUrl),
    registry,
    metrics
  })

  server.listen(config.port, () => {
    console.log(`[collab] Serveur WebSocket démarré sur le port ${config.port}`)
    console.log(`[collab] Métriques disponibles sur http://localhost:${config.port}/metrics`)
  })

  process.on('SIGTERM', async () => {
    server.close()
    await Promise.allSettled([kafka.disconnect(), redis.disconnect()])
    process.exit(0)
  })
}

main().catch(err => {
  console.error('[collab] Erreur démarrage:', err)
  process.exit(1)
})
