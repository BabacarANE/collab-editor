import { Kafka, type Producer } from 'kafkajs'
import type { UpdateSink } from './UpdateSink'

const TOPIC = 'doc-operations'
const RETRY_DELAY_MS = 10_000

// Journal des opérations CRDT, consommé par le service persistence
export class KafkaOperationLog implements UpdateSink {
  readonly name = 'kafka'
  private readonly kafka: Kafka
  private readonly producer: Producer

  constructor(broker: string) {
    this.kafka = new Kafka({ clientId: 'collab-server', brokers: [broker], retry: { retries: 3 } })
    this.producer = this.kafka.producer()
  }

  // Non bloquant : réessaie en arrière-plan tant que Kafka est indisponible
  async connect(): Promise<void> {
    try {
      await this.producer.connect()
      console.log('[collab] Kafka producer connecté')
      const admin = this.kafka.admin()
      await admin.connect()
      if (!(await admin.listTopics()).includes(TOPIC)) {
        await admin.createTopics({ topics: [{ topic: TOPIC, numPartitions: 3, replicationFactor: 1 }] })
        console.log(`[collab] Topic ${TOPIC} créé`)
      }
      await admin.disconnect()
    } catch {
      console.error('[collab] Kafka non disponible, retry dans 10s')
      setTimeout(() => this.connect(), RETRY_DELAY_MS)
    }
  }

  async publish(docId: string, update: Uint8Array): Promise<void> {
    await this.producer.send({
      topic: TOPIC,
      messages: [{ key: docId, value: Buffer.from(update), headers: { docId, timestamp: Date.now().toString() } }]
    })
  }

  disconnect(): Promise<void> {
    return this.producer.disconnect()
  }
}
