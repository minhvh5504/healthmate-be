/*
  Warnings:

  - The values [STAFF,KITCHEN,BAR] on the enum `Role` will be removed. If these variants are still used in the database, this will fail.
  - The values [PHONE_VERIFICATION] on the enum `VerificationType` will be removed. If these variants are still used in the database, this will fail.
  - You are about to drop the column `phone` on the `users` table. All the data in the column will be lost.
  - You are about to drop the column `phoneVerified` on the `users` table. All the data in the column will be lost.
  - You are about to drop the column `phone` on the `verification_codes` table. All the data in the column will be lost.

*/
-- AlterEnum
BEGIN;
CREATE TYPE "Role_new" AS ENUM ('ADMIN', 'USER');
ALTER TABLE "public"."users" ALTER COLUMN "role" DROP DEFAULT;
ALTER TABLE "users" ALTER COLUMN "role" TYPE "Role_new" USING ("role"::text::"Role_new");
ALTER TYPE "Role" RENAME TO "Role_old";
ALTER TYPE "Role_new" RENAME TO "Role";
DROP TYPE "public"."Role_old";
ALTER TABLE "users" ALTER COLUMN "role" SET DEFAULT 'USER';
COMMIT;

-- AlterEnum
BEGIN;
CREATE TYPE "VerificationType_new" AS ENUM ('EMAIL_VERIFICATION', 'PASSWORD_RESET');
ALTER TABLE "verification_codes" ALTER COLUMN "type" TYPE "VerificationType_new" USING ("type"::text::"VerificationType_new");
ALTER TYPE "VerificationType" RENAME TO "VerificationType_old";
ALTER TYPE "VerificationType_new" RENAME TO "VerificationType";
DROP TYPE "public"."VerificationType_old";
COMMIT;

-- DropIndex
DROP INDEX "users_phone_idx";

-- DropIndex
DROP INDEX "users_phone_key";

-- DropIndex
DROP INDEX "verification_codes_phone_idx";

-- AlterTable
ALTER TABLE "users" DROP COLUMN "phone",
DROP COLUMN "phoneVerified",
ALTER COLUMN "role" SET DEFAULT 'USER';

-- AlterTable
ALTER TABLE "verification_codes" DROP COLUMN "phone";
