/*
  Warnings:

  - You are about to drop the column `note` on the `medication_logs` table. All the data in the column will be lost.
  - You are about to alter the column `quantity` on the `medication_logs` table. The data in that column could be lost. The data in that column will be cast from `Decimal(10,2)` to `Integer`.
  - You are about to drop the column `strength` on the `medications` table. All the data in the column will be lost.
  - You are about to alter the column `quantity` on the `reminder_schedules` table. The data in that column could be lost. The data in that column will be cast from `Decimal(10,2)` to `Integer`.
  - You are about to drop the column `meal_instruction_note` on the `user_medications` table. All the data in the column will be lost.
  - You are about to alter the column `quantity` on the `user_medications` table. The data in that column could be lost. The data in that column will be cast from `Decimal(10,2)` to `Integer`.

*/
-- AlterTable
ALTER TABLE "medication_logs" DROP COLUMN "note",
ADD COLUMN     "meal_instruction" VARCHAR(50),
ALTER COLUMN "quantity" SET DATA TYPE INTEGER;

-- AlterTable
ALTER TABLE "medications" DROP COLUMN "strength",
ADD COLUMN     "dosage" VARCHAR(50);

-- AlterTable
ALTER TABLE "reminder_schedules" ALTER COLUMN "quantity" SET DEFAULT 1,
ALTER COLUMN "quantity" SET DATA TYPE INTEGER;

-- AlterTable
ALTER TABLE "user_medications" DROP COLUMN "meal_instruction_note",
ALTER COLUMN "meal_instruction" SET DATA TYPE VARCHAR(50),
ALTER COLUMN "quantity" SET DEFAULT 1,
ALTER COLUMN "quantity" SET DATA TYPE INTEGER;
