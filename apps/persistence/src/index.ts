import { Kafka } from 'kafkajs'
import { PrismaClient } from '@prisma/client'

const KAFKA_BROKER = process.env.KAFKA_BROKER ?? 'kafka:29092'
const prisma = new PrismaClient()

// ─── Kafka Consumer ──────────────────────────────────────────────────────────
// Un consumer group permet d'avoir plusieurs instances du service persistence
// Kafka distribue les partitions entre elles automatiquement
const kafka = new Kafka({
  clientId: 'persistence-service',
  brokers: [KAFKA_BROKER],
  retry: { retries: 10 }
})

const consumer = kafka.consumer({
  groupId: 'persistence-group',
  // Attendre d'avoir 10 messages ou 500ms avant de traiter — optimise les writes PostgreSQL
  maxWaitTimeInMs: 500
})

async function start() {
  await consumer.connect()
  console.log('[persistence] Kafka consumer connecté')

  await consumer.subscribe({ topic: 'doc-operations', fromBeginning: false })
  console.log('[persistence] Abonné au topic doc-operations')

  // Batch processing — on traite les messages par lot pour réduire les requêtes SQL
  await consumer.run({
    eachBatchAutoResolve: true,
    eachBatch: async ({ batch, resolveOffset, heartbeat }) => {
      console.log(`[persistence] Traitement batch de ${batch.messages.length} messages`)

      // Préparer les données pour un insert en bulk
      const operations = batch.messages
        .filter(msg => msg.value && msg.headers?.docId)
        .map(msg => ({
          docId: msg.headers!.docId!.toString(),
          payload: msg.value!,
          createdAt: msg.timestamp
            ? new Date(Number(msg.timestamp))
            : new Date()
        }))

      if (operations.length > 0) {
        try {
          // createMany insère tous les messages en une seule requête SQL
          await prisma.operationLog.createMany({ data: operations })
          console.log(`[persistence] ${operations.length} opérations persistées`)
        } catch (err) {
          console.error('[persistence] Erreur PostgreSQL:', err)
          // Ne pas résoudre l'offset — Kafka va retry
          return
        }
      }

      // Marquer tous les messages comme traités
      for (const message of batch.messages) {
        resolveOffset(message.offset)
        await heartbeat()
      }
    }
  })
}

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('[persistence] Arrêt graceful...')
  await consumer.disconnect()
  await prisma.$disconnect()
  process.exit(0)
})

start().catch(err => {
  console.error('[persistence] Erreur démarrage:', err)
  process.exit(1)
})