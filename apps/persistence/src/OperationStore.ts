import type { PrismaClient } from '@prisma/client'
import type { OperationRow } from './operations'

export interface OperationStore {
  saveMany(rows: OperationRow[]): Promise<void>
}

export class PrismaOperationStore implements OperationStore {
  constructor(private readonly prisma: PrismaClient) {}

  // createMany : une seule requête SQL pour tout le batch
  async saveMany(rows: OperationRow[]): Promise<void> {
    await this.prisma.operationLog.createMany({ data: rows })
  }
}
