import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient({
  datasources: {
    db: {
      url: process.env.DATABASE_URL ?? 'postgresql://collabuser:collabpass123@127.0.0.1:5432/collab?sslmode=disable'
    }
  }
})

export default prisma