import type { EachBatchPayload } from 'kafkajs'
import { toOperationRows } from './operations'
import type { OperationStore } from './OperationStore'

type BatchContext = Pick<EachBatchPayload, 'batch' | 'resolveOffset' | 'heartbeat'>

// Persiste un batch puis valide ses offsets. En cas d'erreur, l'exception
// remonte : avec eachBatchAutoResolve, un simple return validerait les
// offsets et les opérations seraient perdues. kafkajs relira le batch.
export function createBatchHandler(store: OperationStore) {
  return async ({ batch, resolveOffset, heartbeat }: BatchContext): Promise<void> => {
    const rows = toOperationRows(batch.messages)
    if (rows.length > 0) {
      try {
        await store.saveMany(rows)
        console.log(`[persistence] ${rows.length} opérations persistées`)
      } catch (err) {
        console.error('[persistence] Erreur PostgreSQL:', err)
        throw err
      }
    }
    for (const message of batch.messages) {
      resolveOffset(message.offset)
      await heartbeat()
    }
  }
}
