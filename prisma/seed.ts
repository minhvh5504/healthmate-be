import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import * as dotenv from 'dotenv';

dotenv.config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log('🌱 Starting seed data for Healthmate...');

  const timeSlots = [
    { slug: 'before_breakfast', displayName: 'Trước bữa sáng', defaultTime: '07:00' },
    { slug: 'after_breakfast', displayName: 'Sau bữa sáng', defaultTime: '08:00' },
    { slug: 'between_meals', displayName: 'Giữa các bữa ăn', defaultTime: '10:00' },
    { slug: 'before_lunch', displayName: 'Trước bữa trưa', defaultTime: '11:00' },
    { slug: 'after_lunch', displayName: 'Sau bữa trưa', defaultTime: '13:00' },
    { slug: 'before_dinner', displayName: 'Trước bữa tối', defaultTime: '17:00' },
    { slug: 'after_dinner', displayName: 'Sau bữa tối', defaultTime: '19:00' },
    { slug: 'before_sleep', displayName: 'Trước khi ngủ', defaultTime: '22:00' },
  ];

  for (const slot of timeSlots) {
    await prisma.notificationTimeSlot.upsert({
      where: { slug: slot.slug },
      update: slot,
      create: slot,
    });
  }

  const conditions = [
    { slug: 'diabetes', displayName: 'Diabetes', iconEmoji: '💧', sortOrder: 1 },
    { slug: 'angina', displayName: 'Angina', iconEmoji: '🔥', sortOrder: 2 },
    { slug: 'high_cholesterol', displayName: 'High Cholesterol', iconEmoji: '🟡', sortOrder: 3 },
    { slug: 'digestive_health', displayName: 'Digestive Health', iconEmoji: '🍎', sortOrder: 4 },
    { slug: 'varicose_veins', displayName: 'Varicose Veins', iconEmoji: '🧍', sortOrder: 5 },
    { slug: 'heart_failure', displayName: 'Heart Failure', iconEmoji: '💔', sortOrder: 6 },
    { slug: 'hypertension', displayName: 'Hypertension', iconEmoji: '📊', sortOrder: 7 },
  ];

  for (const condition of conditions) {
    await prisma.medicationCondition.upsert({
      where: { slug: condition.slug },
      update: condition,
      create: condition,
    });
  }

  const bmiBenchmarks = [
    // Males
    { type: 'BMI', gender: 'male', ageMin: 0, ageMax: 17, value: 18.5, unit: 'kg/m2', description: 'Average for males under 18' },
    { type: 'BMI', gender: 'male', ageMin: 18, ageMax: 24, value: 24.9, unit: 'kg/m2', description: 'Average for males 18-24' },
    { type: 'BMI', gender: 'male', ageMin: 25, ageMax: 34, value: 25.5, unit: 'kg/m2', description: 'Average for males 25-34' },
    { type: 'BMI', gender: 'male', ageMin: 35, ageMax: 44, value: 26.2, unit: 'kg/m2', description: 'Average for males 35-44' },
    { type: 'BMI', gender: 'male', ageMin: 45, ageMax: 54, value: 26.5, unit: 'kg/m2', description: 'Average for males 45-54' },
    { type: 'BMI', gender: 'male', ageMin: 55, ageMax: 120, value: 25.8, unit: 'kg/m2', description: 'Average for males 55+' },
    // Females
    { type: 'BMI', gender: 'female', ageMin: 0, ageMax: 17, value: 17.8, unit: 'kg/m2', description: 'Average for females under 18' },
    { type: 'BMI', gender: 'female', ageMin: 18, ageMax: 24, value: 22.5, unit: 'kg/m2', description: 'Average for females 18-24' },
    { type: 'BMI', gender: 'female', ageMin: 25, ageMax: 34, value: 23.8, unit: 'kg/m2', description: 'Average for females 25-34' },
    { type: 'BMI', gender: 'female', ageMin: 35, ageMax: 44, value: 25.0, unit: 'kg/m2', description: 'Average for females 35-44' },
    { type: 'BMI', gender: 'female', ageMin: 45, ageMax: 54, value: 25.5, unit: 'kg/m2', description: 'Average for females 45-54' },
    { type: 'BMI', gender: 'female', ageMin: 55, ageMax: 120, value: 24.8, unit: 'kg/m2', description: 'Average for females 55+' },
  ];

  for (const benchmark of bmiBenchmarks) {
    await prisma.healthBenchmark.upsert({
      where: {
        type_gender_ageMin_ageMax: {
          type: benchmark.type,
          gender: benchmark.gender as any,
          ageMin: benchmark.ageMin,
          ageMax: benchmark.ageMax,
        },
      },
      update: benchmark as any,
      create: benchmark as any,
    });
  }

  console.log('✅ Seed completed successfully!');
}

main()
  .catch((e) => {
    console.error('❌ Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
