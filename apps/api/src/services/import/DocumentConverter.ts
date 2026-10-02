export interface ConvertedDocument {
  title: string
  html: string
}

// Convertit un fichier importé en HTML. Ajouter un format = ajouter une
// implémentation, sans modifier ImportService.
export interface DocumentConverter {
  readonly extensions: readonly string[]
  convert(buffer: Buffer, fallbackTitle: string): Promise<ConvertedDocument>
}
