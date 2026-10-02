import * as Y from 'yjs'
import { docs, getYDoc } from 'y-websocket/bin/utils'
import type { Metrics } from '../metrics'
import type { RemoteUpdateHandler } from './RedisUpdateBus'
import type { UpdateSink } from './UpdateSink'

const REMOTE_ORIGIN = 'redis'

interface Options {
  sinks: readonly UpdateSink[]
  idleTtlMs: number
  metrics: Metrics
  // Récupère l'état des autres instances au premier chargement
  fetchPeerState: (docId: string) => Promise<void>
}

// Cycle de vie des documents chargés sur cette instance : un seul handler
// de diffusion par document, libération après inactivité
export class DocumentRegistry implements RemoteUpdateHandler {
  private readonly handlers = new Map<string, (update: Uint8Array, origin: unknown) => void>()
  private readonly releaseTimers = new Map<string, NodeJS.Timeout>()
  private readonly clients = new Map<string, number>()

  constructor(private readonly options: Options) {}

  get loadedCount(): number {
    return docs.size
  }

  async acquire(docId: string): Promise<void> {
    this.clients.set(docId, (this.clients.get(docId) ?? 0) + 1)
    this.cancelRelease(docId)
    if (this.handlers.has(docId)) return

    const ydoc = getYDoc(docId)
    const handler = (update: Uint8Array, origin: unknown) => {
      if (origin === REMOTE_ORIGIN) return
      this.fanOut(docId, update)
    }
    ydoc.on('update', handler)
    this.handlers.set(docId, handler)
    await this.options.fetchPeerState(docId)
  }

  release(docId: string): void {
    const remaining = (this.clients.get(docId) ?? 1) - 1
    if (remaining > 0) {
      this.clients.set(docId, remaining)
      return
    }
    this.clients.delete(docId)
    this.releaseTimers.set(docId, setTimeout(() => this.unload(docId), this.options.idleTtlMs))
  }

  // Appliquées seulement aux documents chargés ici (sinon chaque instance
  // garderait tous les documents en mémoire)
  applyRemote(docId: string, update: Uint8Array): void {
    const ydoc = docs.get(docId)
    if (ydoc) Y.applyUpdate(ydoc, update, REMOTE_ORIGIN)
  }

  encodeState(docId: string): Uint8Array | null {
    const ydoc = docs.get(docId)
    return ydoc ? Y.encodeStateAsUpdate(ydoc) : null
  }

  private fanOut(docId: string, update: Uint8Array): void {
    const { metrics, sinks } = this.options
    const end = metrics.operationDuration.startTimer()
    metrics.operations.inc()
    Promise.allSettled(sinks.map(sink =>
      sink.publish(docId, update).catch(err => {
        console.warn(`[collab] ${sink.name} indisponible — opération non transmise:`, (err as Error).message)
      })
    )).finally(() => end())
  }

  private cancelRelease(docId: string): void {
    const timer = this.releaseTimers.get(docId)
    if (timer) {
      clearTimeout(timer)
      this.releaseTimers.delete(docId)
    }
  }

  private unload(docId: string): void {
    this.releaseTimers.delete(docId)
    if (this.clients.has(docId)) return
    const ydoc = docs.get(docId)
    const handler = this.handlers.get(docId)
    if (ydoc && handler) ydoc.off('update', handler)
    this.handlers.delete(docId)
    if (ydoc) {
      docs.delete(docId)
      ydoc.destroy()
    }
    console.log(`[collab] Document libéré: ${docId}`)
  }
}
