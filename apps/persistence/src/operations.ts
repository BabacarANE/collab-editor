import type { KafkaMessage } from 'kafkajs'

export interface OperationRow {
  docId: string
  payload: Buffer
  createdAt: Date
}

// Messages Kafka -> lignes OperationLog (les messages incomplets sont ignorés)
export function toOperationRows(messages: readonly KafkaMessage[]): OperationRow[] {
  return messages
    .filter(msg => msg.value && msg.headers?.docId)
    .map(msg => ({
      docId: msg.headers!.docId!.toString(),
      payload: msg.value!,
      createdAt: msg.timestamp ? new Date(Number(msg.timestamp)) : new Date()
    }))
}
