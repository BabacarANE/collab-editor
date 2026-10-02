import * as Y from 'yjs'
import { WebsocketProvider } from 'y-websocket'

const RECONNECT_DELAY_MS = 1000

// Session de collaboration d'un document : document Yjs + connexion
// WebSocket dont le token est renouvelé avant chaque (re)connexion
export class CollabSession {
  readonly ydoc = new Y.Doc()
  readonly provider: WebsocketProvider
  private disposed = false
  private readonly serverUrl: string
  private readonly docId: string
  private readonly getToken: () => Promise<string>

  constructor(serverUrl: string, docId: string, getToken: () => Promise<string>) {
    this.serverUrl = serverUrl
    this.docId = docId
    this.getToken = getToken
    this.provider = new WebsocketProvider(serverUrl, docId, this.ydoc, { connect: false })
    // Le serveur ferme la connexion à l'expiration du token (ou en cas de
    // refus) : on reprend la main pour se reconnecter avec un token frais
    this.provider.on('connection-close', this.handleClose)
  }

  async connect(): Promise<void> {
    const token = await this.getToken()
    if (this.disposed) return
    this.provider.url = `${this.serverUrl}/${this.docId}?token=${encodeURIComponent(token)}`
    this.provider.connect()
  }

  destroy(): void {
    this.disposed = true
    this.provider.off('connection-close', this.handleClose)
    this.provider.destroy()
    this.ydoc.destroy()
  }

  private handleClose = () => {
    if (this.disposed) return
    this.provider.disconnect()
    setTimeout(() => this.connect().catch(() => { /* nouvel essai à la prochaine fermeture */ }), RECONNECT_DELAY_MS)
  }
}
