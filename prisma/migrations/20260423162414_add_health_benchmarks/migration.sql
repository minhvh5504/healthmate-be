-- CreateTable
CREATE TABLE "health_benchmarks" (
    "id" TEXT NOT NULL,
    "type" VARCHAR(30) NOT NULL,
    "gender" "Gender" NOT NULL,
    "age_min" INTEGER NOT NULL,
    "age_max" INTEGER NOT NULL,
    "value" DECIMAL(5,2) NOT NULL,
    "unit" VARCHAR(20) NOT NULL,
    "description" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "health_benchmarks_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "health_benchmarks_type_gender_age_min_age_max_key" ON "health_benchmarks"("type", "gender", "age_min", "age_max");
