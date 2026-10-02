// Typage minimal de y-websocket/bin/utils (le paquet n'en fournit pas)
declare module 'y-websocket/bin/utils' {
  import type { IncomingMessage } from 'http'
  import type * as Y from 'yjs'

  export const docs: Map<string, Y.Doc>
  export function getYDoc(docName: string, gc?: boolean): Y.Doc
  export function setupWSConnection(
    conn: unknown,
    req: IncomingMessage,
    options?: { docName?: string; gc?: boolean }
  ): void
}
