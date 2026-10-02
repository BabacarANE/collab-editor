// Destination des mises à jour produites localement (diffusion, journal…).
// Ajouter une destination = ajouter une implémentation (DocumentRegistry
// n'a pas à changer).
export interface UpdateSink {
  readonly name: string
  publish(docId: string, update: Uint8Array): Promise<void>
}
