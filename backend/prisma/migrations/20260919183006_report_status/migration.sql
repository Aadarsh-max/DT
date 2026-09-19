-- AlterTable
ALTER TABLE "Report" ADD COLUMN     "content" JSONB,
ADD COLUMN     "errorMsg" TEXT,
ADD COLUMN     "status" TEXT NOT NULL DEFAULT 'GENERATING';

-- CreateIndex
CREATE INDEX "Report_runId_idx" ON "Report"("runId");
