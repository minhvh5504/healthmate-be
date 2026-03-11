import { PrismaPg } from '@prisma/adapter-pg';
import {
  PrismaClient,
  Role,
  VenueType,
  ServiceAreaType,
  QRCodeType,
} from '@prisma/client';
import * as bcrypt from 'bcrypt';

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  throw new Error(
    'DATABASE_URL is missing. Make sure .env is in the backend root (be/) or set DOTENV_CONFIG_PATH.',
  );
}

console.log('Using database URL:', databaseUrl);

const adapter = new PrismaPg({ connectionString: databaseUrl });
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log('🌱 Starting OMMS seed data...');

  // ============================================
  // 1. USERS (Admin, Staff, Kitchen, Bar)
  // ============================================
  console.log('👤 Creating users...');

  const _admin = await prisma.user.upsert({
    where: { email: 'admin@omms.com' },
    update: {},
    create: {
      email: 'admin@omms.com',
      password: await bcrypt.hash('admin123', 10),
      fullName: 'OMMS Administrator',
      role: Role.ADMIN,
      phone: '+84901234567',
      isActive: true,
    },
  });
  void _admin;

  const _staff1 = await prisma.user.upsert({
    where: { email: 'staff1@omms.com' },
    update: {},
    create: {
      email: 'staff1@omms.com',
      password: await bcrypt.hash('staff123', 10),
      fullName: 'Nguyễn Văn Staff',
      role: Role.STAFF,
      phone: '+84901234568',
      isActive: true,
    },
  });
  void _staff1;

  const _staff2 = await prisma.user.upsert({
    where: { email: 'staff2@omms.com' },
    update: {},
    create: {
      email: 'staff2@omms.com',
      password: await bcrypt.hash('staff123', 10),
      fullName: 'Trần Thị Staff',
      role: Role.STAFF,
      phone: '+84901234569',
      isActive: true,
    },
  });
  void _staff2;

  console.log('✅ Created 3 users (1 admin, 2 staff)');

  // ============================================
  // 2. VENUES
  // ============================================
  console.log('🏨 Creating venues...');

  const thaiRestaurant = await prisma.venue.create({
    data: {
      name: 'Thai Restaurant',
      type: VenueType.RESTAURANT,
      description: 'Authentic Thai cuisine with traditional flavors',
      isActive: true,
      isAppOrderable: true,
      displayOrder: 1,
    },
  });

  const palmRestaurant = await prisma.venue.create({
    data: {
      name: 'Palm Restaurant',
      type: VenueType.RESTAURANT,
      description: 'International cuisine and Vietnamese specialties',
      isActive: true,
      isAppOrderable: true,
      displayOrder: 2,
    },
  });

  const lobbyBar = await prisma.venue.create({
    data: {
      name: 'Lobby Bar',
      type: VenueType.BAR,
      description: 'Cocktails, wines, and refreshments',
      isActive: true,
      isAppOrderable: true,
      displayOrder: 3,
    },
  });

  const poolBar = await prisma.venue.create({
    data: {
      name: 'Pool Bar',
      type: VenueType.BAR,
      description: 'Poolside drinks and light snacks (Staff-assisted only)',
      isActive: true,
      isAppOrderable: false, // Pool Bar is staff-assisted only
      displayOrder: 4,
    },
  });

  const roomService = await prisma.venue.create({
    data: {
      name: 'Room Service',
      type: VenueType.ROOM_SERVICE,
      description: 'In-room dining available 24/7',
      isActive: true,
      isAppOrderable: true,
      displayOrder: 5,
    },
  });

  console.log('✅ Created 5 venues');

  // ============================================
  // 3. KITCHEN & BAR STAFF (assigned to venues)
  // ============================================
  console.log('👨‍🍳 Creating kitchen and bar staff...');

  const _thaiKitchen = await prisma.user.create({
    data: {
      email: 'thai.kitchen@omms.com',
      password: await bcrypt.hash('kitchen123', 10),
      fullName: 'Chef Thai Kitchen',
      role: Role.KITCHEN,
      venueId: thaiRestaurant.id,
      isActive: true,
    },
  });
  void _thaiKitchen;

  const _palmKitchen = await prisma.user.create({
    data: {
      email: 'palm.kitchen@omms.com',
      password: await bcrypt.hash('kitchen123', 10),
      fullName: 'Chef Palm Kitchen',
      role: Role.KITCHEN,
      venueId: palmRestaurant.id,
      isActive: true,
    },
  });
  void _palmKitchen;

  const _lobbyBarStaff = await prisma.user.create({
    data: {
      email: 'lobby.bar@omms.com',
      password: await bcrypt.hash('bar123', 10),
      fullName: 'Bartender Lobby',
      role: Role.BAR,
      venueId: lobbyBar.id,
      isActive: true,
    },
  });
  void _lobbyBarStaff;

  const _poolBarStaff = await prisma.user.create({
    data: {
      email: 'pool.bar@omms.com',
      password: await bcrypt.hash('bar123', 10),
      fullName: 'Bartender Pool',
      role: Role.BAR,
      venueId: poolBar.id,
      isActive: true,
    },
  });
  void _poolBarStaff;

  console.log('✅ Created 4 kitchen/bar staff');

  // ============================================
  // 4. CATEGORIES
  // ============================================
  console.log('📂 Creating categories...');

  const appetizers = await prisma.category.create({
    data: {
      name: 'Appetizers',
      description: 'Starters and small plates',
      displayOrder: 1,
    },
  });

  const soups = await prisma.category.create({
    data: { name: 'Soups', description: 'Hot and cold soups', displayOrder: 2 },
  });

  const mainCourses = await prisma.category.create({
    data: {
      name: 'Main Courses',
      description: 'Entrees and main dishes',
      displayOrder: 3,
    },
  });

  const seafood = await prisma.category.create({
    data: {
      name: 'Seafood',
      description: 'Fresh seafood dishes',
      displayOrder: 4,
    },
  });

  const desserts = await prisma.category.create({
    data: {
      name: 'Desserts',
      description: 'Sweet treats and desserts',
      displayOrder: 5,
    },
  });

  const beverages = await prisma.category.create({
    data: {
      name: 'Beverages',
      description: 'Drinks and refreshments',
      displayOrder: 6,
    },
  });

  const cocktails = await prisma.category.create({
    data: {
      name: 'Cocktails',
      description: 'Signature cocktails and mixed drinks',
      displayOrder: 7,
    },
  });

  const wines = await prisma.category.create({
    data: {
      name: 'Wines',
      description: 'Red, white, and sparkling wines',
      displayOrder: 8,
    },
  });

  console.log('✅ Created 8 categories');

  // ============================================
  // 5. DISHES - Thai Restaurant
  // ============================================
  console.log('🍜 Creating Thai Restaurant dishes...');

  await prisma.dish.createMany({
    data: [
      // Appetizers
      {
        categoryId: appetizers.id,
        venueId: thaiRestaurant.id,
        name: 'Spring Rolls',
        description: 'Fresh vegetables wrapped in rice paper',
        price: 85000,
        isAvailable: true,
      },
      {
        categoryId: appetizers.id,
        venueId: thaiRestaurant.id,
        name: 'Satay Chicken',
        description: 'Grilled chicken skewers with peanut sauce',
        price: 95000,
        isAvailable: true,
      },
      // Soups
      {
        categoryId: soups.id,
        venueId: thaiRestaurant.id,
        name: 'Tom Yum Goong',
        description: 'Spicy and sour shrimp soup',
        price: 120000,
        isAvailable: true,
      },
      {
        categoryId: soups.id,
        venueId: thaiRestaurant.id,
        name: 'Tom Kha Gai',
        description: 'Coconut chicken soup',
        price: 110000,
        isAvailable: true,
      },
      // Main Courses
      {
        categoryId: mainCourses.id,
        venueId: thaiRestaurant.id,
        name: 'Pad Thai',
        description: 'Stir-fried rice noodles with shrimp',
        price: 135000,
        isAvailable: true,
      },
      {
        categoryId: mainCourses.id,
        venueId: thaiRestaurant.id,
        name: 'Green Curry Chicken',
        description: 'Spicy green curry with chicken and vegetables',
        price: 145000,
        isAvailable: true,
      },
      {
        categoryId: mainCourses.id,
        venueId: thaiRestaurant.id,
        name: 'Massaman Beef',
        description: 'Rich and mild curry with tender beef',
        price: 165000,
        isAvailable: true,
      },
      // Desserts
      {
        categoryId: desserts.id,
        venueId: thaiRestaurant.id,
        name: 'Mango Sticky Rice',
        description: 'Sweet sticky rice with fresh mango',
        price: 75000,
        isAvailable: true,
      },
    ],
  });

  console.log('✅ Created 8 Thai Restaurant dishes');

  // ============================================
  // 6. DISHES - Palm Restaurant
  // ============================================
  console.log('🍽️ Creating Palm Restaurant dishes...');

  await prisma.dish.createMany({
    data: [
      // Appetizers
      {
        categoryId: appetizers.id,
        venueId: palmRestaurant.id,
        name: 'Caesar Salad',
        description: 'Classic Caesar with parmesan and croutons',
        price: 95000,
        isAvailable: true,
      },
      {
        categoryId: appetizers.id,
        venueId: palmRestaurant.id,
        name: 'Bruschetta',
        description: 'Toasted bread with tomatoes and basil',
        price: 85000,
        isAvailable: true,
      },
      // Soups
      {
        categoryId: soups.id,
        venueId: palmRestaurant.id,
        name: 'French Onion Soup',
        description: 'Caramelized onions with cheese',
        price: 105000,
        isAvailable: true,
      },
      // Main Courses
      {
        categoryId: mainCourses.id,
        venueId: palmRestaurant.id,
        name: 'Grilled Salmon',
        description: 'Fresh salmon with lemon butter sauce',
        price: 285000,
        isAvailable: true,
      },
      {
        categoryId: mainCourses.id,
        venueId: palmRestaurant.id,
        name: 'Beef Tenderloin',
        description: 'Premium beef with red wine reduction',
        price: 395000,
        isAvailable: true,
      },
      {
        categoryId: mainCourses.id,
        venueId: palmRestaurant.id,
        name: 'Chicken Cordon Bleu',
        description: 'Breaded chicken with ham and cheese',
        price: 195000,
        isAvailable: true,
      },
      // Seafood
      {
        categoryId: seafood.id,
        venueId: palmRestaurant.id,
        name: 'Lobster Thermidor',
        description: 'Lobster in creamy sauce',
        price: 485000,
        isAvailable: true,
      },
      // Desserts
      {
        categoryId: desserts.id,
        venueId: palmRestaurant.id,
        name: 'Tiramisu',
        description: 'Classic Italian coffee dessert',
        price: 95000,
        isAvailable: true,
      },
      {
        categoryId: desserts.id,
        venueId: palmRestaurant.id,
        name: 'Crème Brûlée',
        description: 'Vanilla custard with caramelized sugar',
        price: 85000,
        isAvailable: true,
      },
    ],
  });

  console.log('✅ Created 9 Palm Restaurant dishes');

  // ============================================
  // 7. DISHES - Lobby Bar
  // ============================================
  console.log('🍹 Creating Lobby Bar drinks...');

  await prisma.dish.createMany({
    data: [
      // Cocktails
      {
        categoryId: cocktails.id,
        venueId: lobbyBar.id,
        name: 'Mojito',
        description: 'Rum, mint, lime, and soda',
        price: 125000,
        isAvailable: true,
      },
      {
        categoryId: cocktails.id,
        venueId: lobbyBar.id,
        name: 'Margarita',
        description: 'Tequila, lime, and triple sec',
        price: 135000,
        isAvailable: true,
      },
      {
        categoryId: cocktails.id,
        venueId: lobbyBar.id,
        name: 'Piña Colada',
        description: 'Rum, coconut, and pineapple',
        price: 145000,
        isAvailable: true,
      },
      // Wines
      {
        categoryId: wines.id,
        venueId: lobbyBar.id,
        name: 'Chardonnay',
        description: 'White wine - glass',
        price: 95000,
        isAvailable: true,
      },
      {
        categoryId: wines.id,
        venueId: lobbyBar.id,
        name: 'Cabernet Sauvignon',
        description: 'Red wine - glass',
        price: 105000,
        isAvailable: true,
      },
      // Beverages
      {
        categoryId: beverages.id,
        venueId: lobbyBar.id,
        name: 'Fresh Orange Juice',
        description: 'Freshly squeezed orange juice',
        price: 65000,
        isAvailable: true,
      },
      {
        categoryId: beverages.id,
        venueId: lobbyBar.id,
        name: 'Iced Coffee',
        description: 'Vietnamese iced coffee',
        price: 55000,
        isAvailable: true,
      },
    ],
  });

  console.log('✅ Created 7 Lobby Bar drinks');

  // ============================================
  // 8. DISHES - Pool Bar
  // ============================================
  console.log('🏊 Creating Pool Bar drinks...');

  await prisma.dish.createMany({
    data: [
      {
        categoryId: cocktails.id,
        venueId: poolBar.id,
        name: 'Tropical Punch',
        description: 'Mixed fruit punch with rum',
        price: 115000,
        isAvailable: true,
      },
      {
        categoryId: cocktails.id,
        venueId: poolBar.id,
        name: 'Blue Lagoon',
        description: 'Vodka, blue curaçao, and lemonade',
        price: 125000,
        isAvailable: true,
      },
      {
        categoryId: beverages.id,
        venueId: poolBar.id,
        name: 'Coconut Water',
        description: 'Fresh young coconut',
        price: 45000,
        isAvailable: true,
      },
      {
        categoryId: beverages.id,
        venueId: poolBar.id,
        name: 'Smoothie Bowl',
        description: 'Mixed fruit smoothie',
        price: 85000,
        isAvailable: true,
      },
    ],
  });

  console.log('✅ Created 4 Pool Bar drinks');

  // ============================================
  // 9. DISHES - Room Service
  // ============================================
  console.log('🛎️ Creating Room Service menu...');

  await prisma.dish.createMany({
    data: [
      // Breakfast items
      {
        categoryId: mainCourses.id,
        venueId: roomService.id,
        name: 'American Breakfast',
        description: 'Eggs, bacon, toast, and coffee',
        price: 185000,
        isAvailable: true,
      },
      {
        categoryId: mainCourses.id,
        venueId: roomService.id,
        name: 'Continental Breakfast',
        description: 'Pastries, fruit, and juice',
        price: 145000,
        isAvailable: true,
      },
      // Sandwiches
      {
        categoryId: appetizers.id,
        venueId: roomService.id,
        name: 'Club Sandwich',
        description: 'Triple-decker with chicken and bacon',
        price: 125000,
        isAvailable: true,
      },
      // Beverages
      {
        categoryId: beverages.id,
        venueId: roomService.id,
        name: 'Coffee',
        description: 'Hot coffee',
        price: 45000,
        isAvailable: true,
      },
      {
        categoryId: beverages.id,
        venueId: roomService.id,
        name: 'Tea Selection',
        description: 'Assorted teas',
        price: 45000,
        isAvailable: true,
      },
    ],
  });

  console.log('✅ Created 5 Room Service items');

  // ============================================
  // 10. SERVICE AREAS - Rooms
  // ============================================
  console.log('🚪 Creating rooms...');

  const rooms: Array<{
    type: ServiceAreaType;
    name: string;
    description: string;
    isActive: boolean;
  }> = [];
  for (let floor = 1; floor <= 5; floor++) {
    for (let room = 1; room <= 20; room++) {
      const roomNumber = `${floor}${String(room).padStart(2, '0')}`;
      rooms.push({
        type: ServiceAreaType.ROOM,
        name: `Room ${roomNumber}`,
        description: `Floor ${floor}`,
        isActive: true,
      });
    }
  }

  await prisma.serviceArea.createMany({ data: rooms });
  console.log('✅ Created 100 rooms');

  // ============================================
  // 11. SERVICE AREAS - Tables (Thai Restaurant)
  // ============================================
  console.log('🪑 Creating Thai Restaurant tables...');

  const thaiTables: Array<{
    type: ServiceAreaType;
    venueId: string;
    name: string;
    description: string;
    isActive: boolean;
  }> = [];
  for (let i = 1; i <= 25; i++) {
    thaiTables.push({
      type: ServiceAreaType.TABLE,
      venueId: thaiRestaurant.id,
      name: `Thai Table ${String(i).padStart(2, '0')}`,
      description: 'Thai Restaurant',
      isActive: true,
    });
  }

  await prisma.serviceArea.createMany({ data: thaiTables });
  console.log('✅ Created 25 Thai Restaurant tables');

  // ============================================
  // 12. SERVICE AREAS - Tables (Palm Restaurant)
  // ============================================
  console.log('🪑 Creating Palm Restaurant tables...');

  const palmTables: Array<{
    type: ServiceAreaType;
    venueId: string;
    name: string;
    description: string;
    isActive: boolean;
  }> = [];
  for (let i = 1; i <= 25; i++) {
    palmTables.push({
      type: ServiceAreaType.TABLE,
      venueId: palmRestaurant.id,
      name: `Palm Table ${String(i).padStart(2, '0')}`,
      description: 'Palm Restaurant',
      isActive: true,
    });
  }

  await prisma.serviceArea.createMany({ data: palmTables });
  console.log('✅ Created 25 Palm Restaurant tables');

  // ============================================
  // 13. SERVICE AREAS - Tables (Lobby Bar)
  // ============================================
  console.log('🪑 Creating Lobby Bar seating...');

  const lobbySeats: Array<{
    type: ServiceAreaType;
    venueId: string;
    name: string;
    description: string;
    isActive: boolean;
  }> = [];
  for (let i = 1; i <= 15; i++) {
    lobbySeats.push({
      type: ServiceAreaType.TABLE,
      venueId: lobbyBar.id,
      name: `Lobby Seat ${String(i).padStart(2, '0')}`,
      description: 'Lobby Bar',
      isActive: true,
    });
  }

  await prisma.serviceArea.createMany({ data: lobbySeats });
  console.log('✅ Created 15 Lobby Bar seats');

  // ============================================
  // 14. QR CODES - Generate for all service areas
  // ============================================
  console.log('📱 Creating QR codes...');

  const allServiceAreas = await prisma.serviceArea.findMany();

  for (const area of allServiceAreas) {
    const qrCode = `QR-${area.type}-${area.id.substring(0, 8)}`;

    await prisma.qRCode.create({
      data: {
        serviceAreaId: area.id,
        venueId: area.venueId,
        code: qrCode,
        type: QRCodeType.ORDER, // All QR codes allow ordering
        isActive: true,
      },
    });
  }

  console.log(`✅ Created ${allServiceAreas.length} QR codes`);

  // ============================================
  // SUMMARY
  // ============================================
  console.log('\n🎉 OMMS Seed completed successfully!\n');
  console.log('📊 Summary:');
  console.log('  - Users: 7 (1 admin, 2 staff, 2 kitchen, 2 bar)');
  console.log('  - Venues: 5 (Thai, Palm, Lobby Bar, Pool Bar, Room Service)');
  console.log('  - Categories: 8');
  console.log('  - Dishes: 33 (distributed across venues)');
  console.log('  - Service Areas: 165 (100 rooms + 65 tables)');
  console.log('  - QR Codes: 165\n');
  console.log('🔐 Login credentials:');
  console.log('  Admin: admin@omms.com / admin123');
  console.log('  Staff: staff1@omms.com / staff123');
  console.log('  Thai Kitchen: thai.kitchen@omms.com / kitchen123');
  console.log('  Lobby Bar: lobby.bar@omms.com / bar123\n');
}

main()
  .catch((e) => {
    console.error('❌ Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
