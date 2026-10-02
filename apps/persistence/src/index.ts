import { Kafka } from 'kafkajs'
import { PrismaClient } from '@prisma/client'
import { createBatchHandler } from './batchHandler'
import { PrismaOperationStore } from './OperationStore'

const KAFKA_BROKER = process.env.KAFKA_BROKER ?? process.env.KAFKA_BROKERS ?? 'kafka:29092'
const TOPIC = 'doc-operations'

// Racine de composition : consumer group (les partitions sont réparties
// automatiquement entre les instances du service)
async function main() {
  const prisma = new PrismaClient()
  const kafka = new Kafka({ clientId: 'persistence-service', brokers: [KAFKA_BROKER], retry: { retries: 10 } })
  const consumer = kafka.consumer({ groupId: 'persistence-group', maxWaitTimeInMs: 500 })

  await consumer.connect()
  await consumer.subscribe({ topic: TOPIC, fromBeginning: false })
  console.log(`[persistence] Abonné au topic ${TOPIC}`)

  await consumer.run({
    eachBatchAutoResolve: true,
    eachBatch: createBatchHandler(new PrismaOperationStore(prisma))
  })

  process.on('SIGTERM', async () => {
    console.log('[persistence] Arrêt graceful...')
    await consumer.disconnect()
    await prisma.$disconnect()
    process.exit(0)
  })
}

main().catch(err => {
  console.error('[persistence] Erreur démarrage:', err)
  process.exit(1)
})
