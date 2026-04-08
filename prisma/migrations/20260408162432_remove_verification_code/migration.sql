/*
  Warnings:

  - You are about to drop the column `image_url` on the `medications` table. All the data in the column will be lost.
  - You are about to drop the `verification_codes` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "verification_codes" DROP CONSTRAINT "verification_codes_user_id_fkey";

-- AlterTable
ALTER TABLE "medications" DROP COLUMN "image_url";

-- DropTable
DROP TABLE "verification_codes";

-- DropEnum
DROP TYPE "VerificationType";
