-- CreateEnum
CREATE TYPE "ScanStatus" AS ENUM ('PENDING', 'SUCCESS', 'FAILED');

-- CreateTable
CREATE TABLE "medication_scan_tasks" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "status" "ScanStatus" NOT NULL DEFAULT 'PENDING',
    "scanned_text" TEXT,
    "raw_scanned_data" JSONB,
    "medication_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "medication_scan_tasks_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "medication_scan_tasks_user_id_status_idx" ON "medication_scan_tasks"("user_id", "status");

-- AddForeignKey
ALTER TABLE "medication_scan_tasks" ADD CONSTRAINT "medication_scan_tasks_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "medication_scan_tasks" ADD CONSTRAINT "medication_scan_tasks_medication_id_fkey" FOREIGN KEY ("medication_id") REFERENCES "medications"("id") ON DELETE SET NULL ON UPDATE CASCADE;
