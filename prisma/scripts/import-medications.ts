import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import * as dotenv from 'dotenv';
import * as fs from 'fs';

dotenv.config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  const filePath = process.env.MEDICATIONS_FILE_PATH || './prisma/data/medications.json';
  console.log(`Reading file from ${filePath}...`);

  if (!fs.existsSync(filePath)) {
    console.error(`File not found: ${filePath}`);
    return;
  }

  const rawData = fs.readFileSync(filePath, 'utf8');
  const medications = JSON.parse(rawData);

  console.log(`Found ${medications.length} medications in JSON. Starting import...`);

  let importedCount = 0;
  let skippedCount = 0;
  const total = medications.length;

  // Process in chunks to avoid overwhelming the DB and for better logging
  const chunkSize = 100;
  for (let i = 0; i < total; i += chunkSize) {
    const chunk = medications.slice(i, i + chunkSize);

    for (const med of chunk) {
      // Check for existing record by name, strength and manufacturer to avoid duplicates
      const existing = await prisma.medication.findFirst({
        where: {
          name: med.name,
          dosage: med.strength,
          manufacturer: med.manufacturer,
        },
      });

      if (!existing) {
        await prisma.medication.create({
          data: {
            name: med.name,
            genericName: med.generic_name,
            form: med.form,
            dosage: med.strength,
            manufacturer: med.manufacturer,
            description: med.description,
          },
        });
        importedCount++;
      } else {
        skippedCount++;
      }
    }

    console.log(
      `Progress: ${Math.min(i + chunkSize, total)}/${total} (Imported: ${importedCount}, Skipped: ${skippedCount})`,
    );
  }

  console.log(`\n✅ Import completed!`);
  console.log(`- Total processed: ${total}`);
  console.log(`- New medications added: ${importedCount}`);
  console.log(`- Skipped (already exist): ${skippedCount}`);
}

main()
  .catch((e) => {
    console.error('❌ Import failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
