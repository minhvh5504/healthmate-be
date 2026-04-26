-- CreateTable
CREATE TABLE "user_health_logs" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "height_cm" DECIMAL(5,2),
    "weight_kg" DECIMAL(5,2),
    "bmi" DECIMAL(5,2),
    "bmi_status" VARCHAR(50),
    "recorded_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_health_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "user_health_logs_user_id_recorded_at_idx" ON "user_health_logs"("user_id", "recorded_at");

-- AddForeignKey
ALTER TABLE "user_health_logs" ADD CONSTRAINT "user_health_logs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
