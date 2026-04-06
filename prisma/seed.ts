import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';

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
