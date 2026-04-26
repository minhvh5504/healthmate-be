-- AlterTable
ALTER TABLE "medication_logs" ADD COLUMN     "quantity" DECIMAL(10,2);

-- AlterTable
ALTER TABLE "reminder_schedules" ADD COLUMN     "quantity" DECIMAL(10,2) DEFAULT 1;

-- AlterTable
ALTER TABLE "user_medications" ADD COLUMN     "quantity" DECIMAL(10,2) DEFAULT 1;
