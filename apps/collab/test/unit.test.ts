import { after, describe, test } from 'node:test'
import assert from 'node:assert/strict'
import * as Y from 'yjs'
import * as encoding from 'lib0/encoding'
import { docs } from 'y-websocket/bin/utils'
import { createMetrics } from '../src/metrics'
import { isWriteMessage, parseDocId } from '../src/protocol'
import { DocumentRegistry } from '../src/sync/DocumentRegistry'
import type { UpdateSink } from '../src/sync/UpdateSink'

function message(...varUints: number[]): Buffer {
  const encoder = encoding.createEncoder()
  for (const n of varUints) encoding.writeVarUint(encoder, n)
  encoding.writeVarUint8Array(encoder, new Uint8Array([1, 2, 3]))
  return Buffer.from(encoding.toUint8Array(encoder))
}

describe('protocole', () => {
  test('parseDocId accepte le préfixe /ws et refuse les identifiants invalides', () => {
    assert.equal(parseDocId('/abc-123'), 'abc-123')
    assert.equal(parseDocId('/ws/abc-123'), 'abc-123')
    assert.equal(parseDocId('/../etc/passwd'), null)
    assert.equal(parseDocId('/%E0%A4%A'), null)
    assert.equal(parseDocId('/' + 'a'.repeat(65)), null)
  })

  test('isWriteMessage : seuls sync step2 et update modifient le document', () => {
    assert.equal(isWriteMessage(message(0, 0)), false) // sync step 1 (lecture)
    assert.equal(isWriteMessage(message(0, 1)), true)  // sync step 2
    assert.equal(isWriteMessage(message(0, 2)), true)  // update
    assert.equal(isWriteMessage(message(1)), false)    // awareness
    assert.equal(isWriteMessage(Buffer.from([])), true) // illisible : refusé
  })
})

describe('DocumentRegistry', () => {
  // Les documents y-websocket gardent un timer d'awareness actif
  after(() => {
    for (const [id, doc] of docs) {
      doc.destroy()
      docs.delete(id)
    }
  })

  function setup() {
    const published: string[] = []
    const sink: UpdateSink = { name: 'fake', publish: async docId => { published.push(docId) } }
    const peerRequests: string[] = []
    const registry = new DocumentRegistry({
      sinks: [sink],
      idleTtlMs: 20,
      metrics: createMetrics(() => docs.size),
      fetchPeerState: async docId => { peerRequests.push(docId) }
    })
    return { registry, published, peerRequests }
  }

  test('un seul handler de diffusion quel que soit le nombre de clients', async () => {
    const { registry, published, peerRequests } = setup()
    await registry.acquire('doc-a')
    await registry.acquire('doc-a')
    await registry.acquire('doc-a')
    docs.get('doc-a')!.getText('t').insert(0, 'x')
    await new Promise(r => setTimeout(r, 5))
    assert.deepEqual(published, ['doc-a'])
    assert.deepEqual(peerRequests, ['doc-a'])
  })

  test('les mises à jour distantes ne sont pas rediffusées', async () => {
    const { registry, published } = setup()
    await registry.acquire('doc-b')
    const remote = new Y.Doc()
    remote.getText('t').insert(0, 'distant')
    registry.applyRemote('doc-b', Y.encodeStateAsUpdate(remote))
    await new Promise(r => setTimeout(r, 5))
    assert.equal(docs.get('doc-b')!.getText('t').toString(), 'distant')
    assert.deepEqual(published, [])
  })

  test('mise à jour distante ignorée pour un document non chargé', () => {
    const { registry } = setup()
    registry.applyRemote('jamais-charge', Y.encodeStateAsUpdate(new Y.Doc()))
    assert.equal(docs.has('jamais-charge'), false)
  })

  test('libération après le départ du dernier client', async () => {
    const { registry } = setup()
    await registry.acquire('doc-c')
    await registry.acquire('doc-c')
    registry.release('doc-c')
    await new Promise(r => setTimeout(r, 40))
    assert.equal(docs.has('doc-c'), true)
    registry.release('doc-c')
    await new Promise(r => setTimeout(r, 40))
    assert.equal(docs.has('doc-c'), false)
    assert.equal(registry.encodeState('doc-c'), null)
  })
})
