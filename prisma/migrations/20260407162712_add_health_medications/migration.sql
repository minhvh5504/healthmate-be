-- CreateTable
CREATE TABLE "allergy_types" (
    "id" TEXT NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "display_name" VARCHAR(100) NOT NULL,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "allergy_types_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_allergies" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "allergy_type_id" TEXT,
    "custom_name" VARCHAR(100),
    "note" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_allergies_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "medication_conditions" (
    "id" TEXT NOT NULL,
    "slug" VARCHAR(100) NOT NULL,
    "display_name" VARCHAR(100) NOT NULL,
    "icon_emoji" VARCHAR(10),
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "is_active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "medication_conditions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "medications" (
    "id" TEXT NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "generic_name" VARCHAR(255),
    "form" VARCHAR(20),
    "strength" VARCHAR(50),
    "manufacturer" VARCHAR(255),
    "description" TEXT,
    "image_url" VARCHAR(500),
    "is_verified" BOOLEAN NOT NULL DEFAULT false,
    "created_by" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "medications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_medications" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "medication_id" TEXT NOT NULL,
    "dosage" VARCHAR(100),
    "meal_instruction" VARCHAR(20),
    "meal_instruction_note" VARCHAR(80),
    "condition_id" TEXT,
    "condition_custom" VARCHAR(100),
    "reminder_enabled" BOOLEAN NOT NULL DEFAULT true,
    "start_date" DATE,
    "end_date" DATE,
    "stock_count" INTEGER,
    "low_stock_threshold" INTEGER NOT NULL DEFAULT 5,
    "scanned_data" JSONB,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_medications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "reminder_schedules" (
    "id" TEXT NOT NULL,
    "user_medication_id" TEXT NOT NULL,
    "remind_time" VARCHAR(8),
    "repeat_type" VARCHAR(20) NOT NULL DEFAULT 'daily',
    "repeat_days" INTEGER[],
    "repeat_interval" INTEGER,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "reminder_schedules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "device_tokens" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "token" VARCHAR(500) NOT NULL,
    "platform" VARCHAR(10) NOT NULL,
    "device_name" VARCHAR(100),
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "last_used_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "device_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notifications" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "reminder_schedule_id" TEXT,
    "type" VARCHAR(30) NOT NULL,
    "channel" VARCHAR(10) NOT NULL DEFAULT 'push',
    "icon_type" VARCHAR(30) NOT NULL,
    "title" VARCHAR(200) NOT NULL,
    "body" TEXT NOT NULL,
    "is_read" BOOLEAN NOT NULL DEFAULT false,
    "read_at" TIMESTAMP(3),
    "scheduled_for" TIMESTAMP(3) NOT NULL,
    "sent_at" TIMESTAMP(3),
    "delivery_status" VARCHAR(10) NOT NULL DEFAULT 'pending',
    "failure_reason" VARCHAR(255),
    "action_url" VARCHAR(500),

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "medication_logs" (
    "id" TEXT NOT NULL,
    "user_medication_id" TEXT NOT NULL,
    "reminder_schedule_id" TEXT,
    "notification_id" TEXT,
    "status" VARCHAR(10) NOT NULL,
    "taken_at" TIMESTAMP(3),
    "dosage_taken" VARCHAR(100),
    "note" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "medication_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_relationships" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "related_user_id" TEXT NOT NULL,
    "status" VARCHAR(10) NOT NULL DEFAULT 'pending',
    "invited_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "accepted_at" TIMESTAMP(3),
    "revoked_at" TIMESTAMP(3),

    CONSTRAINT "user_relationships_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "allergy_types_name_key" ON "allergy_types"("name");

-- CreateIndex
CREATE UNIQUE INDEX "user_allergies_user_id_allergy_type_id_key" ON "user_allergies"("user_id", "allergy_type_id");

-- CreateIndex
CREATE UNIQUE INDEX "medication_conditions_slug_key" ON "medication_conditions"("slug");

-- CreateIndex
CREATE INDEX "user_medications_user_id_is_active_idx" ON "user_medications"("user_id", "is_active");

-- CreateIndex
CREATE INDEX "user_medications_user_id_condition_id_idx" ON "user_medications"("user_id", "condition_id");

-- CreateIndex
CREATE UNIQUE INDEX "device_tokens_token_key" ON "device_tokens"("token");

-- CreateIndex
CREATE INDEX "device_tokens_user_id_platform_idx" ON "device_tokens"("user_id", "platform");

-- CreateIndex
CREATE INDEX "notifications_user_id_sent_at_idx" ON "notifications"("user_id", "sent_at");

-- CreateIndex
CREATE INDEX "notifications_user_id_is_read_idx" ON "notifications"("user_id", "is_read");

-- CreateIndex
CREATE INDEX "notifications_scheduled_for_delivery_status_idx" ON "notifications"("scheduled_for", "delivery_status");

-- CreateIndex
CREATE INDEX "notifications_user_id_type_idx" ON "notifications"("user_id", "type");

-- CreateIndex
CREATE INDEX "medication_logs_user_medication_id_created_at_idx" ON "medication_logs"("user_medication_id", "created_at");

-- CreateIndex
CREATE INDEX "medication_logs_user_medication_id_status_idx" ON "medication_logs"("user_medication_id", "status");

-- CreateIndex
CREATE INDEX "user_relationships_related_user_id_status_idx" ON "user_relationships"("related_user_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "user_relationships_user_id_related_user_id_key" ON "user_relationships"("user_id", "related_user_id");

-- AddForeignKey
ALTER TABLE "user_allergies" ADD CONSTRAINT "user_allergies_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_allergies" ADD CONSTRAINT "user_allergies_allergy_type_id_fkey" FOREIGN KEY ("allergy_type_id") REFERENCES "allergy_types"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "medications" ADD CONSTRAINT "medications_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_medications" ADD CONSTRAINT "user_medications_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_medications" ADD CONSTRAINT "user_medications_medication_id_fkey" FOREIGN KEY ("medication_id") REFERENCES "medications"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_medications" ADD CONSTRAINT "user_medications_condition_id_fkey" FOREIGN KEY ("condition_id") REFERENCES "medication_conditions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reminder_schedules" ADD CONSTRAINT "reminder_schedules_user_medication_id_fkey" FOREIGN KEY ("user_medication_id") REFERENCES "user_medications"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "device_tokens" ADD CONSTRAINT "device_tokens_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_reminder_schedule_id_fkey" FOREIGN KEY ("reminder_schedule_id") REFERENCES "reminder_schedules"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "medication_logs" ADD CONSTRAINT "medication_logs_user_medication_id_fkey" FOREIGN KEY ("user_medication_id") REFERENCES "user_medications"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "medication_logs" ADD CONSTRAINT "medication_logs_reminder_schedule_id_fkey" FOREIGN KEY ("reminder_schedule_id") REFERENCES "reminder_schedules"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "medication_logs" ADD CONSTRAINT "medication_logs_notification_id_fkey" FOREIGN KEY ("notification_id") REFERENCES "notifications"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_relationships" ADD CONSTRAINT "user_relationships_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_relationships" ADD CONSTRAINT "user_relationships_related_user_id_fkey" FOREIGN KEY ("related_user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
