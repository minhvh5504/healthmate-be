-- AlterTable
ALTER TABLE "reminder_schedules" ADD COLUMN     "dosage" VARCHAR(50);

-- AlterTable
ALTER TABLE "user_medications" ADD COLUMN     "low_stock_reminder_enabled" BOOLEAN NOT NULL DEFAULT true;
