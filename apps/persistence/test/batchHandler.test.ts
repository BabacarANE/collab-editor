import { test } from 'node:test'
import assert from 'node:assert/strict'
import type { KafkaMessage } from 'kafkajs'
import { createBatchHandler } from '../src/batchHandler'
import { toOperationRows, type OperationRow } from '../src/operations'

function message(offset: string, docId?: string, value: string | null = 'update'): KafkaMessage {
  return {
    offset,
    key: null,
    value: value === null ? null : Buffer.from(value),
    timestamp: '1700000000000',
    attributes: 0,
    headers: docId ? { docId: Buffer.from(docId) } : {}
  } as KafkaMessage
}

function batchOf(messages: KafkaMessage[]) {
  const resolved: string[] = []
  return {
    resolved,
    ctx: {
      batch: { messages } as never,
      resolveOffset: (offset: string) => { resolved.push(offset) },
      heartbeat: async () => {}
    }
  }
}

test('les messages incomplets sont ignorés', () => {
  const rows = toOperationRows([message('1', 'doc-a'), message('2'), message('3', 'doc-b', null)])
  assert.equal(rows.length, 1)
  assert.equal(rows[0].docId, 'doc-a')
  assert.equal(rows[0].createdAt.getTime(), 1700000000000)
})

test('succès : opérations enregistrées puis offsets validés', async () => {
  const saved: OperationRow[] = []
  const { ctx, resolved } = batchOf([message('1', 'doc-a'), message('2', 'doc-a')])
  await createBatchHandler({ saveMany: async rows => { saved.push(...rows) } })(ctx)
  assert.equal(saved.length, 2)
  assert.deepEqual(resolved, ['1', '2'])
})

test('échec de la base : erreur levée et aucun offset validé', async () => {
  const { ctx, resolved } = batchOf([message('1', 'doc-a')])
  const failing = createBatchHandler({ saveMany: async () => { throw new Error('db down') } })
  await assert.rejects(failing(ctx), /db down/)
  assert.deepEqual(resolved, [])
})
