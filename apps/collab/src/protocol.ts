import type { RawData, WebSocket } from 'ws'
import * as decoding from 'lib0/decoding'

// Protocole y-websocket : type de message puis sous-type sync
const MESSAGE_SYNC = 0
const SYNC_STEP2 = 1
const SYNC_UPDATE = 2

// Le chemin peut être préfixé par /ws (ingress Kubernetes)
export function parseDocId(pathname: string): string | null {
  const raw = pathname.replace(/^\/ws(?=\/)/, '').replace(/^\//, '')
  let docId: string
  try { docId = decodeURIComponent(raw) } catch { return null }
  return /^[A-Za-z0-9_-]{1,64}$/.test(docId) ? docId : null
}

// Un message client modifie le document s'il s'agit d'un sync step 2 ou d'un update
export function isWriteMessage(data: RawData): boolean {
  try {
    const buffer = Array.isArray(data) ? Buffer.concat(data) : Buffer.from(data as ArrayBuffer)
    const decoder = decoding.createDecoder(new Uint8Array(buffer))
    if (decoding.readVarUint(decoder) !== MESSAGE_SYNC) return false
    const syncType = decoding.readVarUint(decoder)
    return syncType === SYNC_STEP2 || syncType === SYNC_UPDATE
  } catch {
    return true
  }
}

// Filtre les écritures d'un client en lecture seule avant y-websocket
export function makeReadOnly(ws: WebSocket, onRejected: () => void) {
  const originalEmit = ws.emit.bind(ws)
  ws.emit = ((event: string | symbol, ...args: unknown[]) => {
    if (event === 'message' && isWriteMessage(args[0] as RawData)) {
      onRejected()
      return false
    }
    return originalEmit(event, ...args)
  }) as typeof ws.emit
}
