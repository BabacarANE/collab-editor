import { randomUUID } from 'crypto'
import { createClient } from 'redis'
import type { UpdateSink } from './UpdateSink'

type RedisClient = ReturnType<typeof createClient>

export interface RemoteUpdateHandler {
  // Mise à jour reçue d'une autre instance
  applyRemote(docId: string, update: Uint8Array): void
  // État complet d'un document chargé ici (null sinon), pour une autre instance
  encodeState(docId: string): Uint8Array | null
}

const SYNC_REQUEST_CHANNEL = 'doc-sync-request'

// Diffusion des mises à jour entre instances collab via Redis Pub/Sub
export class RedisUpdateBus implements UpdateSink {
  readonly name = 'redis'
  private readonly instanceId = randomUUID()
  private readonly publisher: RedisClient
  private readonly subscriber: RedisClient
  private readonly waiters = new Map<string, () => void>()

  constructor(url: string) {
    this.publisher = createClient({ url })
    this.subscriber = createClient({ url })
    this.publisher.on('error', err => console.error('[collab] Redis publisher error:', err))
    this.subscriber.on('error', err => console.error('[collab] Redis subscriber error:', err))
  }

  async connect(handler: RemoteUpdateHandler): Promise<void> {
    await this.publisher.connect()
    await this.subscriber.connect()

    await this.subscriber.pSubscribe('doc:*', (message, channel) => {
      const docId = channel.slice('doc:'.length)
      handler.applyRemote(docId, Buffer.from(message, 'base64'))
      this.waiters.get(docId)?.()
    })

    // Une autre instance charge un document : on lui envoie notre état complet
    await this.subscriber.subscribe(SYNC_REQUEST_CHANNEL, message => {
      const [requester, docId] = message.split(':')
      if (requester === this.instanceId) return
      const state = handler.encodeState(docId)
      if (state) this.publish(docId, state).catch(err => console.error('[collab] Erreur Redis publish:', err))
    })
    console.log('[collab] Redis connecté')
  }

  async publish(docId: string, update: Uint8Array): Promise<void> {
    await this.publisher.publish(`doc:${docId}`, Buffer.from(update).toString('base64'))
  }

  // Demande l'état aux autres instances et attend la première réponse
  async requestState(docId: string, timeoutMs: number): Promise<void> {
    try {
      const receivers = await this.publisher.publish(SYNC_REQUEST_CHANNEL, `${this.instanceId}:${docId}`)
      // receivers inclut cette instance : rien à attendre si elle est seule
      if (receivers <= 1) return
      await new Promise<void>(resolve => {
        const timer = setTimeout(() => { this.waiters.delete(docId); resolve() }, timeoutMs)
        this.waiters.set(docId, () => { clearTimeout(timer); this.waiters.delete(docId); resolve() })
      })
    } catch (err) {
      console.error('[collab] Synchronisation inter-instances impossible:', err)
    }
  }

  async disconnect(): Promise<void> {
    await this.publisher.disconnect()
    await this.subscriber.disconnect()
  }
}
