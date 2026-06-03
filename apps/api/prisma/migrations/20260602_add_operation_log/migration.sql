CREATE TABLE "OperationLog" (
    "id" TEXT NOT NULL,
    "docId" TEXT NOT NULL,
    "payload" BYTEA NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "OperationLog_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "OperationLog_docId_createdAt_idx" ON "OperationLog"("docId", "createdAt");