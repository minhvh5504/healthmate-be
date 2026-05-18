/*
  Warnings:

  - You are about to drop the column `is_verified` on the `medications` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[username]` on the table `users` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "medications" DROP COLUMN IF EXISTS "is_verified";

-- AlterTable
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "username" VARCHAR(255);
ALTER TABLE "users" ALTER COLUMN "email" DROP NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "users_username_key" ON "users"("username");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "users_username_idx" ON "users"("username");
