-- AlterTable
ALTER TABLE "Document" ADD COLUMN     "searchVector" tsvector;

-- CreateIndex
CREATE INDEX "Document_workspaceId_idx" ON "Document"("workspaceId");
