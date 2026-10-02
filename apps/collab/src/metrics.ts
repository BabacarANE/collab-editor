import { Counter, Gauge, Histogram, Registry, collectDefaultMetrics } from 'prom-client'

// Pas de label docId : une série par document ferait exploser la cardinalité
export function createMetrics(loadedDocuments: () => number) {
  const registry = new Registry()
  collectDefaultMetrics({ register: registry })

  return {
    registry,
    connections: new Gauge({
      name: 'collab_websocket_connections_active',
      help: 'Nombre de connexions WebSocket actives',
      registers: [registry]
    }),
    documentsLoaded: new Gauge({
      name: 'collab_documents_loaded',
      help: 'Nombre de documents chargés en mémoire',
      registers: [registry],
      collect() { this.set(loadedDocuments()) }
    }),
    operations: new Counter({
      name: 'collab_operations_total',
      help: 'Nombre total d\'opérations Yjs reçues',
      registers: [registry]
    }),
    rejectedWrites: new Counter({
      name: 'collab_rejected_writes_total',
      help: 'Écritures refusées (utilisateur en lecture seule)',
      registers: [registry]
    }),
    operationDuration: new Histogram({
      name: 'collab_operation_duration_seconds',
      help: 'Durée de traitement des opérations Yjs',
      buckets: [0.001, 0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5],
      registers: [registry]
    })
  }
}

export type Metrics = ReturnType<typeof createMetrics>
