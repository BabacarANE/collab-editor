export interface ExportableDocument {
  title: string
  // HTML déjà nettoyé
  content: string
}

export interface ExportResult {
  contentType: string
  body: string | Buffer
}

// Un format d'export. Ajouter un format = ajouter une implémentation.
export interface DocumentExporter {
  readonly format: string
  export(document: ExportableDocument): Promise<ExportResult>
}
