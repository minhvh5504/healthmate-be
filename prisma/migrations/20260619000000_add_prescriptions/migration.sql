-- CreateEnum
CREATE TYPE "PrescriptionStatus" AS ENUM ('ACTIVE', 'COMPLETED');

-- CreateTable
CREATE TABLE "prescriptions" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "doctor_name" VARCHAR(255),
    "clinic_name" VARCHAR(255),
    "image_url" VARCHAR(500) NOT NULL,
    "image_public_id" VARCHAR(255),
    "start_date" DATE NOT NULL,
    "end_date" DATE,
    "note" TEXT,
    "status" "PrescriptionStatus" NOT NULL DEFAULT 'ACTIVE',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "prescriptions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "prescriptions_user_id_status_idx" ON "prescriptions"("user_id", "status");

-- CreateIndex
CREATE INDEX "prescriptions_user_id_start_date_idx" ON "prescriptions"("user_id", "start_date");

-- AddForeignKey
ALTER TABLE "prescriptions" ADD CONSTRAINT "prescriptions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
