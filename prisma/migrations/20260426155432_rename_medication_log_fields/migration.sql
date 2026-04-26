/*
  Warnings:

  - You are about to drop the column `dosage_taken` on the `medication_logs` table. All the data in the column will be lost.
  - You are about to drop the column `quantity` on the `medication_logs` table. All the data in the column will be lost.
  - You are about to drop the column `taken_at` on the `medication_logs` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "medication_logs" DROP COLUMN "dosage_taken",
DROP COLUMN "quantity",
DROP COLUMN "taken_at",
ADD COLUMN     "actual_at" TIMESTAMP(3),
ADD COLUMN     "actual_quantity" INTEGER;
