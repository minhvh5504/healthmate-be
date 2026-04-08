import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import * as fs from 'fs';
import * as path from 'path';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log('💊 Bắt đầu import dữ liệu Medications vào Database...');

  // Đường dẫn trỏ tới file json
  const jsonPath = path.resolve(__dirname, '../../thuoc/medications.json');

  if (!fs.existsSync(jsonPath)) {
    console.error(`❌ Không tìm thấy file dữ liệu tại: ${jsonPath}`);
    return;
  }

  // Khai báo mảng chứa dữ liệu
  const fileContent = fs.readFileSync(jsonPath, 'utf8');
  const rawData: any[] = JSON.parse(fileContent);

  console.log(`Tiến hành xử lý ${rawData.length} bản ghi...`);

  // Đảm bảo dữ liệu từ file json không bị trùng lặp tên
  const uniqueDataMap = new Map<string, any>();
  for (const item of rawData) {
    if (item.name && !uniqueDataMap.has(item.name)) {
      uniqueDataMap.set(item.name, item);
    }
  }
  const uniqueData = Array.from(uniqueDataMap.values());

  // XOÁ TOÀN BỘ DATA CŨ ĐỂ ĐỔ LẠI TỪ ĐẦU (Thep yêu cầu mới nhất)
  console.log('🗑️ Xoá bỏ dữ liệu thuốc (Medications) cũ trong database...');
  await prisma.medication.deleteMany({});

  console.log(
    `🔍 File gốc có ${rawData.length} bản ghi, sau khi lọc trùng tên còn ${uniqueData.length} bản ghi.`,
  );

  // Chỉ import các trường khớp 100% với schema.prisma (external_id, source_url, ... đã được loại bỏ)
  const medicationsDataToInsert = uniqueData.map((item) => ({
    name: item.name,
    genericName: item.generic_name || null,
    form: item.form || null,
    strength: item.strength || null,
    manufacturer: item.manufacturer || null,
    description: item.description || null,
    isVerified: item.is_verified || false,
  }));

  if (medicationsDataToInsert.length === 0) {
    console.log('⚠️ Không có dữ liệu để insert!');
    return;
  }

  // Insert bulk dữ liệu mới vào database
  console.log(
    `Đang lưu (import) ${medicationsDataToInsert.length} loại thuốc chuẩn schema vào database...`,
  );
  const result = await prisma.medication.createMany({
    data: medicationsDataToInsert,
    skipDuplicates: true,
  });

  console.log(`✅ Import thành công ${result.count} loại thuốc!`);
}

main()
  .catch((e) => {
    console.error('❌ Lỗi trong quá trình import:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
